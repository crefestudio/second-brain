const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createCommunity}=require('../lib/community');
const {createCommunityNotifications}=require('../lib/community-notifications');
const {createCommunityDelivery,canSendCommunityEmail}=require('../lib/community-delivery');
const {createMailQueue}=require('../lib/mail-queue');
const {renderCommunityNewsletter}=require('../lib/community-newsletter');

test('newsletter renders escaped text, paragraphs and preference link',()=>{
 const mail=renderCommunityNewsletter('<script>title</script>','<img src=x onerror=alert(1)>\nline\n\nnext','https://club.notionable.net/club?post=test');
 assert.ok(!mail.html.includes('<script>'));assert.ok(!mail.html.includes('<img'));
 assert.ok(mail.html.includes('&lt;img'));assert.ok(mail.html.includes('<br>'));
 assert.ok(mail.text.includes('settings=notifications'));assert.ok(mail.html.includes('settings=notifications'));
});

test('admin share selection produces one newsletter, suppresses duplicate alerts and enforces consent', {skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):/);
 const app=initializeApp({projectId:'demo-community-sharing'},'sharing'),db=getFirestore(app);
 let clock=1800000000000;
 const admin={uid:'admin',name:'운영자',isAdmin:true},reader={uid:'reader',name:'회원',isAdmin:false};
 const api=createCommunity(db,()=>clock),store=createCommunityNotifications(db,()=>clock);
 const input={action:'savePost',postId:'newsletter',roomId:'notion',kind:'feed',title:'소식 <test>',body:'본문\n\n두 번째 문단',version:0,sharing:{newsletter:true,kakao:false,instagram:true}};
 try {
  for(const name of ['communityMembers','communityMemberPrivate','communityPosts','communityNotificationEvents','communityMailQueue','mailDailyUsage','mailQueueControl'])await db.recursiveDelete(db.collection(name));
  for(const u of [admin,reader])await api(u,{action:'join',name:u.name,consent:true,emailNotifications:true,talkNotifications:true});
  await assert.rejects(api(reader,input),e=>e.status===403);
  await assert.rejects(api(admin,{...input,sharing:{newsletter:'yes',kakao:false}}),e=>e.status===400);
  await api(admin,input);await api(admin,input);
  await assert.rejects(api(reader,{action:'instagramLink',postId:'newsletter',url:'https://www.instagram.com/p/real-post/'}),e=>e.status===403);
  for(const url of ['javascript:alert(1)','https://instagram.com.evil.test/p/abc/','https://www.instagram.com/notionable_net/']) await assert.rejects(api(admin,{action:'instagramLink',postId:'newsletter',url}),e=>e.status===400);
  const linked=await api(admin,{action:'instagramLink',postId:'newsletter',url:'https://instagram.com/p/real-post/?tracking=1'});
  assert.equal(linked.post.sharedInstagramUrl,'https://www.instagram.com/p/real-post/');
  assert.equal(linked.post.newsletterSentCount,0);
  assert.equal((await api(reader,{action:'post',postId:'newsletter'})).post.newsletterSentCount,undefined);
  let events=await db.collection('communityNotificationEvents').get();assert.equal(events.size,1);
  const event=events.docs[0];assert.deepEqual(event.get('newsletter'),{title:input.title,body:input.body});
  await store.fanout(event.id);await store.fanout(event.id);
  const auth={getUser:async uid=>({uid,email:uid+'@example.test',emailVerified:true})};
  const queue=createMailQueue(db,async()=>{throw Error('must not actually send');},(email,mail)=>canSendCommunityEmail(db,auth,mail?.communityRecipientId,email),'communityMailQueue');
  const delivery=createCommunityDelivery(db,auth,async(uid,to,subject,text,key,html)=>{await queue.enqueue({from:'test@example.test',to,subject,text,...(html?{html}:{}),communityRecipientId:uid},'normal',key);},{ready:()=>false},()=>clock);
  await delivery.deliver(reader.uid,event.id);await delivery.deliver(reader.uid,event.id);
  const queued=await db.collection('communityMailQueue').get();assert.equal(queued.size,1);
  const raw=JSON.stringify(queued.docs[0].data());assert.ok(raw.includes('노셔너블 클럽 뉴스레터'));assert.ok(raw.includes('&lt;test&gt;'));assert.ok(!raw.includes('새로운 알림이 있습니다'));
  const inbox=db.collection('communityMemberPrivate').doc(reader.uid).collection('notifications');
  assert.equal((await inbox.get()).size,1);assert.equal((await inbox.doc(event.id).get()).get('delivery.talk'),'disabled');
  clock+=20000;await api(admin,{...input,version:1,title:'수정됨',body:'수정된 본문'});
  events=await db.collection('communityNotificationEvents').get();assert.equal(events.size,1);assert.equal(events.docs[0].get('newsletter.body'),input.body);
  await api(reader,{action:'notificationSettings',email:false,talk:false});
  assert.equal(await queue.attempt(queued.docs[0].id),'cancelled');
  clock+=20000;await api(admin,{...input,postId:'normal',sharing:{newsletter:false,kakao:true,instagram:false}});
  const normal=(await db.collection('communityNotificationEvents').get()).docs.find(x=>x.id!==event.id);
  await store.fanout(normal.id);await delivery.deliver(reader.uid,normal.id);
  assert.equal((await inbox.doc(normal.id).get()).get('delivery.email'),'disabled');
  await api(reader,{action:'notificationSettings',email:true,talk:true});await delivery.deliver(reader.uid,normal.id);
  assert.equal((await inbox.doc(normal.id).get()).get('delivery.talk'),'not-configured');
  const all=await db.collection('communityMailQueue').get();assert.equal(all.size,2);
  assert.ok(all.docs.some(x=>JSON.stringify(x.data()).includes('새로운 알림이 있습니다')));
  const counterQueue=createMailQueue(db,async()=>({data:{id:'accepted-test'},error:null}),async()=>true,'communityMailQueue');
  const [countId]=await counterQueue.enqueue({from:'test@example.test',to:'reader@example.test',subject:'newsletter',text:'test',communityNewsletterPostId:'newsletter'},'normal','counter-test');
  await db.collection('mailQueueControl').doc('sender').set({nextSendAt:0},{merge:true});
  await counterQueue.attempt(countId);await counterQueue.attempt(countId);
  assert.equal((await api(admin,{action:'post',postId:'newsletter'})).post.newsletterSentCount,1);
  assert.equal((await api(reader,{action:'post',postId:'newsletter'})).post.newsletterSentCount,undefined);
  assert.equal((await db.collection('communityMailQueue').doc(countId).get()).get('mail'),undefined);
 } finally {await db.terminate();await deleteApp(app);}
});
