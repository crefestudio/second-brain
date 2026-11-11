const {test}=require('node:test'),assert=require('node:assert/strict');
const {notificationPreferences,validNotificationPreferences,NOTIFICATION_CATEGORIES}=require('../lib/community-notification-settings');
const {notificationSettings,notificationCategory}=require('../lib/community-notifications');
const {createCommunity}=require('../lib/community');
const {createCommunityDelivery,canSendCommunityEmail}=require('../lib/community-delivery');
const {memoryDb}=require('./helpers/memory-db.cjs');
test('legacy channel choices are preserved for every purpose; input requires all eight booleans',()=>{
 const prefs=notificationPreferences({email:false,talk:true});
 for(const {id} of NOTIFICATION_CATEGORIES)assert.deepEqual(prefs[id],{email:false,talk:true});
 assert.equal(validNotificationPreferences(prefs),true);
 for(const bad of [null,[],{}, {...prefs,events:{email:'yes',talk:true}}, {...prefs,other:{email:true,talk:true}}])assert.equal(validNotificationPreferences(bad),false);
 assert.equal(notificationCategory({type:'comment'}),'activity');
 assert.equal(notificationCategory({type:'admin-post'},'announcements'),'notices');
 assert.equal(notificationCategory({type:'admin-post'},'events'),'events');
 assert.equal(notificationCategory({type:'admin-post'},'lifeup'),'adminPosts');
});
test('preferences persist independently, legacy saves replace all categories, unrelated data survives',async()=>{
 const f=memoryDb({'communityMembers/me':{active:true,name:'Me'},'communityMemberPrivate/me':{lastChatAt:123,notificationSettings:{email:false,talk:false,confirmedAt:1}}});
 const api=createCommunity(f.db,()=>100000),who={uid:'me',name:'Me',isAdmin:false};
 const categories=notificationPreferences({email:false,talk:false});categories.notices.email=true;categories.events.talk=true;
 await api(who,{action:'notificationSettings',categories});
 assert.deepEqual((await api(who,{action:'state'})).notificationSettings.categories,categories);
 assert.equal(f.rows.get('communityMemberPrivate/me').lastChatAt,123);
 await api(who,{action:'notificationSettings',email:false,talk:false});
 assert.deepEqual((await api(who,{action:'state'})).notificationSettings.categories,notificationPreferences({email:false,talk:false}));
 await assert.rejects(api(who,{action:'notificationSettings',categories:{events:{email:true,talk:false}}}),e=>e.status===400);
 await assert.rejects(api({uid:'outsider'},{action:'notificationSettings',categories}),e=>e.status===403);
});
test('each notification purpose gates email and talk independently, including queued mail rechecks',async()=>{
 for(const {id} of NOTIFICATION_CATEGORIES) {
  const categories=notificationPreferences({email:false,talk:false});categories[id]={email:true,talk:false};
  const event={type:id==='activity'?'comment':'admin-post',category:id,actorId:'admin',actorName:'Admin',postId:'p',postTitle:'Title',createdAt:100000};
  const f=memoryDb({'communityMembers/me':{active:true},'communityMembers/admin':{active:true},'communityMemberPrivate/me':{notificationSettings:{categories,confirmedAt:1}},'communityPosts/p':{authorId:'admin',roomId:'events'},'communityMemberPrivate/me/notifications/event':event});
  const auth={getUser:async()=>({emailVerified:true,disabled:false,email:'me@example.test'})};
  const queued=[];
  const delivery=createCommunityDelivery(f.db,auth,async(...args)=>queued.push(args),{ready:()=>false},()=>100001);
  await delivery.deliver('me','event');assert.equal(queued.length,1);assert.equal(queued[0][7],id);
  assert.equal(f.rows.get('communityMemberPrivate/me/notifications/event')['delivery.talk'],'disabled');
  assert.equal(await canSendCommunityEmail(f.db,auth,'me','me@example.test',id),true);
  const other=NOTIFICATION_CATEGORIES.find(c=>c.id!==id).id;
  assert.equal(await canSendCommunityEmail(f.db,auth,'me','me@example.test',other),false);
  categories[id]={email:false,talk:true};f.rows.set('communityMemberPrivate/me',{notificationSettings:{categories,confirmedAt:1}});
  assert.equal(await canSendCommunityEmail(f.db,auth,'me','me@example.test',id),false,'queued email must honor changed settings');
  await delivery.deliver('me','event');assert.equal(queued.length,1);
  assert.equal(f.rows.get('communityMemberPrivate/me/notifications/event')['delivery.talk'],'not-configured');
 }
});
test('new admin events capture the room category; join saves granular consent',async()=>{
 const f=memoryDb({}),api=createCommunity(f.db,()=>100000),admin={uid:'admin',name:'Admin',isAdmin:true};
 const categories=notificationPreferences({email:false,talk:false});categories.activity.email=true;
 await api(admin,{action:'join',name:'Admin',consent:true,categories});
 assert.deepEqual(notificationSettings(f.rows.get('communityMemberPrivate/admin')).categories,categories);
 for(const [roomId,expected] of [['announcements','notices'],['events','events'],['lifeup','adminPosts']]) {
  f.rows.set('communityMemberPrivate/admin',{notificationSettings:{categories,confirmedAt:1},lastPostAt:0});
  await api(admin,{action:'savePost',postId:roomId,roomId,kind:'feed',title:'Title',body:'Body',version:0});
  const event=[...f.rows.entries()].find(([p,v])=>p.startsWith('communityNotificationEvents/')&&v.postId===roomId)[1];assert.equal(event.category,expected);
 }
});
