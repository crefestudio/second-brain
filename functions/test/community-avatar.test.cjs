const {test} = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {normalizeCommunityAvatar} = require('../lib/community-avatar');
const {createCommunity, CommunityError} = require('../lib/community');
const photo = async (color, format='png') => 'data:image/' + format + ';base64,' + (await sharp({create:{width:400,height:300,channels:3,background:color}}).toFormat(format).toBuffer()).toString('base64');

test('avatar normalization decodes, crops and strips metadata; invalid payloads fail', async () => {
  for (const format of ['png','jpeg','webp']) {
    const result = await normalizeCommunityAvatar(await photo('#4080c0',format));
    const bytes = Buffer.from(result.split(',')[1],'base64');
    const info = await sharp(bytes).metadata();
    assert.equal(info.format,'jpeg'); assert.equal(info.width,192); assert.equal(info.height,192);
    assert.ok(bytes.length <= 48*1024); assert.equal(info.exif,undefined);
  }
  const exif = await sharp({create:{width:300,height:200,channels:3,background:'#abcdef'}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const normalized = await normalizeCommunityAvatar('data:image/jpeg;base64,' + exif.toString('base64'));
  assert.equal((await sharp(Buffer.from(normalized.split(',')[1],'base64')).metadata()).exif,undefined);
  assert.equal(await normalizeCommunityAvatar(''),'');
  for (const value of [null, {}, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/jpeg;base64,YmFk', 'x'.repeat(180001), (await photo('#000')).replace('image/png','image/jpeg')]) {
    await assert.rejects(normalizeCommunityAvatar(value), e => e.status === 400);
  }
});

test('only own member avatar changes and historical posts/comments use the current photo', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):/);
  const app=initializeApp({projectId:'demo-community-avatar'},'avatar'), db=getFirestore(app);
  const api=createCommunity(db,()=>1800000000000);
  const alice={uid:'alice',name:'Alice',isAdmin:false},bob={uid:'bob',name:'Bob',isAdmin:false},guest={uid:'guest',name:'Guest',isAdmin:false};
  try {
    for(const name of ['communityPosts','communityMembers','communityMemberPrivate','communityNotificationEvents']) await db.recursiveDelete(db.collection(name));
    for(const who of [alice,bob]) await api(who,{action:'join',name:who.name,consent:true});
    await api(alice,{action:'savePost',postId:'old-post',roomId:'questions',kind:'question',title:'Existing post',body:'Existing body',version:0});
    await api(bob,{action:'saveComment',postId:'old-post',commentId:'old-reply',body:'Existing reply',version:0});
    await api(alice,{action:'accept',postId:'old-post',commentId:'old-reply',accepted:true});
    const update={action:'profile',name:'Alice',bio:'Bio',avatar:await photo('#ff8800'),userId:'bob',isAdmin:true};
    await assert.rejects(api(guest,update),e=>e.status===403);
    const saved=(await api(alice,update)).member;
    assert.ok(saved.avatar.startsWith('data:image/jpeg;base64,')); assert.equal(saved.isAdmin,false);
    assert.equal((await api(bob,{action:'state'})).member.avatar,undefined);
    assert.equal((await api(alice,{action:'state'})).member.avatar,saved.avatar);
    assert.equal((await api(bob,{action:'members'})).members.find(m=>m.id==='alice').avatar,saved.avatar);
    assert.equal((await api(bob,{action:'feed'})).posts[0].authorAvatar,saved.avatar);
    const replyPhoto=(await api(bob,{action:'profile',name:'Bob',bio:'',avatar:await photo('#4488ff')})).member.avatar;
    const detail=await api(alice,{action:'post',postId:'old-post'});
    assert.equal(detail.post.authorAvatar,saved.avatar);
    assert.equal(detail.comments[0].authorAvatar,replyPhoto); assert.equal(detail.accepted.authorAvatar,replyPhoto);
    await api(alice,{action:'profile',name:'Alice renamed',bio:'Updated'});
    assert.equal((await api(alice,{action:'state'})).member.avatar,saved.avatar);
    await assert.rejects(api(alice,{...update,avatar:'data:image/jpeg;base64,YmFk'}),e=>e instanceof CommunityError && e.status===400);
    assert.equal((await api(alice,{action:'state'})).member.avatar,saved.avatar);
    await api(alice,{action:'profile',name:'Alice',bio:'',avatar:''});
    assert.equal((await api(bob,{action:'feed'})).posts[0].authorAvatar,'');
    assert.equal((await api(alice,{action:'state'})).member.avatar,undefined);
    await db.collection('communityMembers').doc('bob').update({active:false});
    const inactive=await api(alice,{action:'post',postId:'old-post'});
    assert.equal(inactive.comments[0].authorAvatar,''); assert.equal(inactive.accepted.authorAvatar,'');
  } finally { await deleteApp(app); }
});
