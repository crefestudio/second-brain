const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createCommunity}=require('../lib/community');

test('room unread counts are personal, persistent and track individual visible posts', {skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):/);
 const app=initializeApp({projectId:'demo-community-unread'},'unread'),db=getFirestore(app);
 let clock=1800000000000;const api=createCommunity(db,()=>clock);
 const a={uid:'a',name:'a',isAdmin:false},b={uid:'b',name:'b',isAdmin:false};
 const counts=()=>api(a,{action:'roomUnreadCounts',uid:'b'});
 const save=(postId,extra={})=>api(b,{action:'savePost',postId,roomId:'notion',kind:'feed',title:postId,body:'body',version:0,...extra});
 try {
  for(const name of ['communityPosts','communityMembers','communityMemberPrivate'])await db.recursiveDelete(db.collection(name));
  await api(b,{action:'join',name:'b',consent:true});await save('before-join');clock+=20000;
  await api(a,{action:'join',name:'a',consent:true});
  assert.equal((await counts()).counts.notion,0);
  await save('older');clock+=20000;await save('newer');
  assert.equal((await counts()).counts.notion,2);
  await api(a,{action:'feed',roomId:'notion'});assert.equal((await counts()).counts.notion,2);
  await api(a,{action:'post',postId:'newer'});assert.equal((await counts()).counts.notion,1);
  await api(a,{action:'post',postId:'newer'});assert.equal((await counts()).counts.notion,1);
  assert.equal((await createCommunity(db,()=>clock)(a,{action:'roomUnreadCounts'})).counts.notion,1);
  await save('newer',{version:1,title:'edited'});assert.equal((await counts()).counts.notion,1);
  await save('older',{version:1,roomId:'gtd'});
  assert.equal((await counts()).counts.notion,0);assert.equal((await counts()).counts.gtd,1);
  await api(b,{action:'deletePost',postId:'older',version:2});assert.equal((await counts()).counts.gtd,0);
  clock+=20000;await api(a,{action:'savePost',postId:'own',roomId:'notion',kind:'feed',title:'own',body:'body',version:0});
  assert.equal((await counts()).counts.notion,0);
  assert.equal((await api(b,{action:'roomUnreadCounts'})).counts.notion,1);
  await assert.rejects(api({uid:'outsider',name:'out',isAdmin:false},{action:'roomUnreadCounts'}),e=>e.status===403);
 } finally {await db.terminate();await deleteApp(app);}
});
