const {test} = require('node:test');
const assert = require('node:assert/strict');
const {COMMUNITY_ROOMS,isCommunityRoomVisible} = require('../lib/community-model');
const {createCommunity} = require('../lib/community');
const {initializeApp,deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('hidden room posts stay stored but cannot be listed, opened or changed; restoring a room restores access', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async()=>{
    assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):/);
    const app=initializeApp({projectId:'demo-community-visibility'},'room-visibility'), db=getFirestore(app);
    const api=createCommunity(db,()=>1800000000000);
    const who={uid:'member',name:'Member',isAdmin:false};
    const hidden=COMMUNITY_ROOMS.find(r=>r.id==='requests');
    try {
        await db.collection('communityMembers').doc(who.uid).set({name:'Member',active:true,joinedAt:1});
        for(const roomId of ['requests','hello']) await db.collection('communityPosts').doc(roomId).set({roomId,visible:true,kind:'feed',title:roomId,body:'Preserved content',authorId:who.uid,authorName:'Member',createdAt:100,updatedAt:100,version:1,likes:0,comments:0,acceptedCommentId:null});
        assert.equal(isCommunityRoomVisible('requests'),false);
        assert.equal(isCommunityRoomVisible('budget'),true);
        assert.deepEqual((await api(who,{action:'feed'})).posts.map(p=>p.id),['hello']);
        assert.deepEqual((await api(who,{action:'feed',mine:true})).posts.map(p=>p.id),['hello']);
        const counts=(await api(who,{action:'roomUnreadCounts'})).counts;
        assert.equal(counts.requests,undefined);assert.equal(counts.budget,0);
        for(const roomId of ['requests']) {
            await assert.rejects(api(who,{action:'feed',roomId}),e=>e.status===400);
            await assert.rejects(api(who,{action:'post',postId:roomId}),e=>e.status===404);
            await assert.rejects(api(who,{action:'savePost',postId:'new-'+roomId,roomId,title:'Title',body:'Body',kind:'feed',version:0}),e=>e.status===400);
            await assert.rejects(api(who,{action:'saveComment',postId:roomId,commentId:'reply',body:'Body',version:0}),e=>e.status===404);
            assert.equal((await db.collection('communityPosts').doc(roomId).get()).get('body'),'Preserved content');
        }
        hidden.hidden=false;
        assert.equal((await api(who,{action:'post',postId:'requests'})).post.body,'Preserved content');
        assert.equal((await api(who,{action:'feed',roomId:'requests'})).posts.length,1);
    } finally {
        hidden.hidden=true;
        for(const collection of ['communityMembers','communityPosts','communityMemberPrivate']) await db.recursiveDelete(db.collection(collection));
        await deleteApp(app);
    }
});
