const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createCommunity}=require('../lib/community');
const {createCommunityNotifications}=require('../lib/community-notifications');
const {createCommunityDelivery,createKakaoEventClient,canSendCommunityEmail}=require('../lib/community-delivery');
const {createMailQueue}=require('../lib/mail-queue');

test('Kakao Event API separates accepted requests from verified delivery and handles ambiguous responses',async()=>{
 const calls=[];let response={status:'SUCCESS',taskId:'task-1'};
 const client=createKakaoEventClient({enabled:true,botId:'bot-test',eventName:'community_notification',apiKey:'test-only'},async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>response};
 });
 assert.equal(client.ready(),true);
 assert.deepEqual(await client.send({type:'botUserKey',id:'recipient'},{text:'알림',url:'https://community.notionable.net/'}),{status:'submitted',taskId:'task-1'});
 const payload=JSON.parse(calls[0].options.body);
 assert.equal(payload.event.name,'community_notification');assert.equal(payload.user[0].type,'botUserKey');
 response={status:'ALL SUCCESS',successCount:1};assert.equal(await client.status('task-1'),'sent');
 response={status:'1 FAIL',successCount:0};assert.equal(await client.status('task-1'),'failed');
 response={status:'ERROR'};assert.equal((await client.send({type:'botUserKey',id:'recipient'},{})).status,'review');
 assert.equal(createKakaoEventClient({enabled:false,botId:'',eventName:'',apiKey:''}).ready(),false);
});

test('community notification outbox, fanout, privacy, preferences and email delivery', {skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):/);
 const app=initializeApp({projectId:'demo-community-notifications'},'notifications-test'),db=getFirestore(app);
 let clock=1800000000000;
 const admin={uid:'admin',name:'운영자',isAdmin:true},a={uid:'a',name:'가',isAdmin:false},b={uid:'b',name:'나',isAdmin:false};
 const api=createCommunity(db,()=>clock,async()=>['admin']),store=createCommunityNotifications(db,()=>clock);
 const post=(id,user,extra={})=>api(user,{action:'savePost',postId:id,roomId:'notion',kind:'feed',title:'테스트',body:'본문',version:0,...extra});
 const inbox=uid=>db.collection('communityMemberPrivate').doc(uid).collection('notifications');
 const events=()=>db.collection('communityNotificationEvents').get();
 async function drain(){for(const e of (await events()).docs)await store.fanout(e.id);}
 try {
  for(const name of ['communityMembers','communityMemberPrivate','communityPosts','communityNotificationEvents','communityTalkDeliveries','communityMailQueue','mailDailyUsage','mailQueueControl','appAccounts']) await db.recursiveDelete(db.collection(name));
  for(const u of [admin,a,b])await api(u,{action:'join',name:u.name,consent:true,emailNotifications:true,talkNotifications:true});
  assert.equal((await api(a,{action:'state'})).notificationSettings.confirmed,true);
  await post('notice',admin);await drain();await drain();
  assert.equal((await api(a,{action:'notifications'})).items.length,1);
  assert.equal((await api(a,{action:'notificationCount'})).unreadCount,1);
  assert.equal((await api(admin,{action:'notifications'})).items.length,0);
  clock+=20000;await post('mine',a,{kind:'question'});
  clock+=20000;await api(b,{action:'saveComment',postId:'mine',commentId:'reply',body:'답변',version:0});
  await api(b,{action:'saveComment',postId:'mine',commentId:'reply',body:'답변',version:0});await drain();
  let list=await api(a,{action:'notifications'});assert.equal(list.items.length,2);
  const reply=list.items.find(x=>x.type==='comment');
  await api(b,{action:'readNotification',notificationId:reply.id});
  assert.equal((await api(a,{action:'notificationCount'})).unreadCount,2);
  await api(a,{action:'readNotification',notificationId:reply.id});await api(a,{action:'readNotification',notificationId:reply.id});
  assert.equal((await api(a,{action:'notificationCount'})).unreadCount,1);
  await api(b,{action:'like',postId:'mine',liked:true});await drain();
  await api(b,{action:'like',postId:'mine',liked:false});await api(b,{action:'like',postId:'mine',liked:true});await drain();
  assert.equal((await api(a,{action:'notifications'})).items.filter(x=>x.type==='like').length,1);
  await api(a,{action:'accept',postId:'mine',commentId:'reply',accepted:true});
  await drain();await api(a,{action:'accept',postId:'mine',commentId:'reply',accepted:true});await drain();
  assert.equal((await api(b,{action:'notifications'})).items.filter(x=>x.type==='accepted').length,1);
  const before=(await events()).size;
  clock+=20000;await api(a,{action:'saveComment',postId:'mine',commentId:'self',body:'내 댓글',version:0});
  assert.equal((await events()).size,before);
  await api(a,{action:'readAllNotifications'});assert.equal((await api(a,{action:'notificationCount'})).unreadCount,0);
  assert.ok((await api(a,{action:'notifications'})).items.every(x=>x.read));
  await db.collection('communityMembers').doc('late').set({active:true,name:'늦게 가입',joinedAt:clock+1000});
  // Replaying a broadcast does not notify someone who joined after the event.
  const event=(await events()).docs.find(d=>d.get('type')==='admin-post');
  await event.ref.update({completedAt:null});await store.fanout(event.id);assert.equal((await inbox('late').get()).size,0);

  const auth={getUser:async uid=>({uid,email:uid+'@example.test',emailVerified:true,disabled:false})};
  const queued=[];const kakao={ready:()=>false};
  const deliver=createCommunityDelivery(db,auth,async(...args)=>queued.push(args),kakao,()=>clock);
  await deliver.deliver('a',reply.id);
  assert.equal(queued.length,1);assert.equal(queued[0][1],'a@example.test');
  assert.ok(!queued[0][3].includes('테스트'));assert.equal((await inbox('a').doc(reply.id).get()).get('delivery.talk'),'not-configured');
  await api(a,{action:'notificationSettings',email:false,talk:false});
  await deliver.deliver('a',reply.id);assert.equal(queued.length,1);
  assert.equal(await canSendCommunityEmail(db,auth,'a','a@example.test'),false);
  await api(a,{action:'notificationSettings',email:true,talk:true});
  assert.equal(await canSendCommunityEmail(db,auth,'a','wrong@example.test'),false);
  assert.equal(await canSendCommunityEmail(db,auth,'a','a@example.test'),true);
  await db.collection('appAccounts').doc('a').set({deletionStatus:'pending'});
  assert.equal(await canSendCommunityEmail(db,auth,'a','a@example.test'),false);
  await db.collection('appAccounts').doc('a').delete();
  const sent=[];const queue=createMailQueue(db,async(mail)=>{sent.push(mail);return {data:{id:'sent'},error:null};},
   (email,mail)=>canSendCommunityEmail(db,auth,mail?.communityRecipientId,email),'communityMailQueue');
  const mail={from:'test@example.test',to:'a@example.test',subject:'알림',text:'새 알림',communityRecipientId:'a'};
  const one=await queue.enqueue(mail,'normal','same'),two=await queue.enqueue(mail,'normal','same');
  assert.deepEqual(one,two);assert.equal((await db.collection('communityMailQueue').get()).size,1);
  await api(a,{action:'notificationSettings',email:false,talk:false});
  assert.equal(await queue.attempt(one[0]),'cancelled');assert.equal(sent.length,0);
  await api(a,{action:'notificationSettings',email:true,talk:true});
  const ids=await queue.enqueue(mail,'normal','another');
  // Previous cancellation releases the shared provider pacing lock.
  await db.collection('mailQueueControl').doc('sender').set({nextSendAt:0},{merge:true});
  assert.equal(await queue.attempt(ids[0]),'sent');assert.equal(sent.length,1);
  const nonmember={uid:'outsider',name:'out',isAdmin:false};
  await assert.rejects(api(nonmember,{action:'notifications'}),e=>e.status===403);
  await assert.rejects(api(a,{action:'notificationSettings',email:'yes',talk:true}),e=>e.status===400);
 } finally {await db.terminate();await deleteApp(app);}
});
