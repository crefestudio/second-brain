const {test} = require('node:test');
const assert = require('node:assert/strict');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {createCommunity} = require('../lib/community');
const {createCommunityNotifications} = require('../lib/community-notifications');

test('private posts enforce access, own feed pagination and targeted notifications', {skip: !process.env.FIRESTORE_EMULATOR_HOST}, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):/);
  const app = initializeApp({projectId: 'demo-community-private'}, 'private');
  const db = getFirestore(app);
  let clock = 1800000000000;
  const alice = {uid:'alice',name:'Alice',isAdmin:false};
  const bob = {uid:'bob',name:'Bob',isAdmin:false};
  const admin = {uid:'admin',name:'Admin',isAdmin:true};
  const api = createCommunity(db, () => clock, async () => ['admin']);
  const post = (postId, extra = {}) => ({action:'savePost',postId,roomId:'notion',kind:'question',title:'Private question',body:'Private body',version:0,...extra});
  const denied = (promise, status) => assert.rejects(promise, e => e.status === status);
  try {
    for (const name of ['communityPosts','communityMembers','communityMemberPrivate','communityNotificationEvents']) await db.recursiveDelete(db.collection(name));
    for (const user of [alice,bob,admin]) await api(user,{action:'join',consent:true,name:user.name});
    const secret = (await api(alice,post('secret',{isPrivate:true}))).post;
    assert.equal(secret.isPrivate,true);
    assert.equal((await api(admin,{action:'roomUnreadCounts'})).counts.notion,1);
    for (const user of [alice,admin]) assert.equal((await api(user,{action:'post',postId:'secret'})).post.body,'Private body');
    for (const input of [
      {action:'post'}, {action:'like',liked:true}, {action:'saveComment',commentId:'attack',body:'reply',version:0},
      {action:'deleteComment',commentId:'attack',version:1}, {action:'accept',commentId:'attack',accepted:true},
      {action:'deletePost',version:1}, post('secret',{version:1,isPrivate:true})
    ]) await denied(api(bob,{...input,postId:'secret'}),404);
    assert.deepEqual((await api(bob,{action:'feed'})).posts,[]);
    assert.equal((await api(bob,{action:'roomUnreadCounts'})).counts.notion,0);
    assert.equal((await api(admin,{action:'roomUnreadCounts'})).counts.notion,0);
    await denied(api(alice,post('secret',{version:1,isPrivate:false})),400);
    await api(alice,post('secret',{version:1,body:'Edited secret'})); // Older clients preserve privacy.
    assert.equal((await api(alice,{action:'post',postId:'secret'})).post.isPrivate,true);
    await denied(api(admin,post('shared',{isPrivate:true,sharing:{newsletter:true,kakao:false,instagram:false}})),400);
    await denied(api(alice,post('invalid',{isPrivate:'true'})),400);
    await denied(api(bob,{action:'feed',mine:'true'}),400);
    await api(admin,{action:'saveComment',postId:'secret',commentId:'answer',body:'Admin answer',version:0});
    await api(alice,{action:'accept',postId:'secret',commentId:'answer',accepted:true});
    const store=createCommunityNotifications(db,()=>clock);
    for (const event of (await db.collection('communityNotificationEvents').get()).docs) await store.fanout(event.id);
    assert.equal((await store.list(bob.uid)).items.length,0);
    assert.ok((await store.list(admin.uid)).items.some(n=>n.type==='private-post'));
    assert.ok((await store.list(alice.uid)).items.some(n=>n.type==='comment'));
    // Interleave more than one raw page of hidden posts with visible posts.
    const seed=db.batch();
    const {id: ignored,...stored}=secret;
    for(let i=0;i<65;i++) seed.set(db.collection('communityPosts').doc('page-'+i),{...JSON.parse(JSON.stringify(stored)),visible:true,isPrivate:i%2===0,authorId:i%2===0?'alice':'bob',createdAt:++clock});
    await seed.commit();
    for (const mine of [false,true]) {
      const ids=[]; let cursor=null;
      do {
        const page=await api(bob,{action:'feed',mine,authorId:'alice',cursor});
        assert.ok(page.posts.every(p=>p.authorId==='bob' && !p.isPrivate));
        ids.push(...page.posts.map(p=>p.id)); cursor=page.nextCursor;
      } while(cursor);
      assert.equal(ids.length,32); assert.equal(new Set(ids).size,32);
    }
    const mine=await api(alice,{action:'feed',mine:true,roomId:'notion',kind:'question'});
    assert.equal(mine.posts.length,20); assert.ok(mine.posts.every(p=>p.authorId==='alice'));
    clock+=20000;
    await api(admin,post('admin-secret',{isPrivate:true}));
    assert.equal((await db.collection('communityNotificationEvents').where('postId','==','admin-secret').get()).size,0);
    await denied(api(admin,{action:'instagramLink',postId:'admin-secret',url:''}),400);
  } finally { await deleteApp(app); }
});
