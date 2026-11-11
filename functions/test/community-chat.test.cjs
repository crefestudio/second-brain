const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createCommunity} = require('../lib/community');
const {memoryDb} = require('./helpers/memory-db.cjs');
function fixture() {
    let clock = 100000;
    const memory = memoryDb(Object.fromEntries(['alice','bob','eve','admin'].map(uid => ['communityMembers/'+uid,{name:uid,active:true,joinedAt:1}])));
    for (const uid of ['alice','bob','eve','admin']) memory.rows.set('communityMemberPrivate/'+uid, {allowMemberDm:true});
    const api = createCommunity(memory.db, () => clock, async()=>['admin']);
    const call = (uid, action, data={}) => api({uid,name:uid,isAdmin:uid==='admin'}, {action,...data});
    return {...memory, call, tick:()=>clock+=2000};
}
test('member DM defaults off, opt-in and revocation are enforced, admins can exchange messages', async()=>{
    const f=fixture();
    f.rows.delete('communityMemberPrivate/bob');
    await assert.rejects(f.call('alice','chatStart',{peerId:'bob'}),e=>e.status===403);
    const {chatId:adminChat}=await f.call('admin','chatStart',{peerId:'bob'});
    await f.call('admin','chatSend',{chatId:adminChat,messageId:'admin-one',body:'hello'});
    f.rows.delete('communityMemberPrivate/admin');
    await f.call('bob','chatSend',{chatId:adminChat,messageId:'reply',body:'reply'});
    await f.call('bob','notificationSettings',{email:false,talk:false,allowMemberDm:true});
    assert.equal((await f.call('bob','state')).allowMemberDm,true);
    const {chatId}=await f.call('alice','chatStart',{peerId:'bob'});
    await f.call('alice','chatSend',{chatId,messageId:'allowed',body:'hello'});
    await f.call('bob','notificationSettings',{email:false,talk:false,allowMemberDm:false});
    f.tick();
    await assert.rejects(f.call('alice','chatSend',{chatId,messageId:'denied',body:'hello'}),e=>e.status===403);
    await assert.rejects(f.call('bob','notificationSettings',{email:false,talk:false,allowMemberDm:'true'}),e=>e.status===400);
    assert.equal((await f.call('bob','state')).allowMemberDm,false);
    await f.call('bob','chatBlock',{chatId:adminChat,blocked:true});
    await assert.rejects(f.call('admin','chatSend',{chatId:adminChat,messageId:'blocked',body:'hello'}),e=>e.status===403);
});
test('DM participant authorization, deterministic rooms, idempotent sending and read races', async()=>{
    const f=fixture(), {chatId}=await f.call('alice','chatStart',{peerId:'bob'});
    assert.equal((await f.call('bob','chatStart',{peerId:'alice'})).chatId,chatId);
    await assert.rejects(f.call('alice','chatStart',{peerId:'alice'}),e=>e.status===400);
    await assert.rejects(f.call('alice','chatStart',{peerId:'missing'}),e=>e.status===403);
    const send={chatId,messageId:'one',body:'Hello Bob'};
    await f.call('alice','chatSend',send);
    await f.call('alice','chatSend',send);
    assert.equal([...f.rows.keys()].filter(p=>p.includes('/messages/')).length,1);
    await assert.rejects(f.call('bob','chatSend',send),e=>e.status===409);
    await assert.rejects(f.call('alice','chatSend',{...send,messageId:'two'}),e=>e.status===429);
    for(const uid of ['eve','admin']) for(const action of ['chatMessages','chatSend','chatRead','chatDelete','chatBlock']) {
        await assert.rejects(f.call(uid,action,{...send,readAt:100000,blocked:true}),e=>e.status===404);
    }
    const inbox=await f.call('bob','chatInbox');
    assert.equal(inbox.hasUnread,true); assert.equal(inbox.items[0].peer.id,'alice');
    assert.equal((await f.call('alice','chatInbox')).hasUnread,false);
    f.tick(); await f.call('alice','chatSend',{...send,messageId:'two',body:'Second'});
    await f.call('bob','chatRead',{chatId,readAt:100000});
    assert.equal((await f.call('bob','chatInbox')).hasUnread,true,'reading an old page must not clear a later message');
    await f.call('bob','chatRead',{chatId,readAt:102000});
    assert.equal((await f.call('bob','chatInbox')).hasUnread,false);
    assert.deepEqual(Object.keys(f.rows.get('communityChatSignals/bob')).sort(),['revision','updatedAt']);
});
test('DM block, deletion, withdrawn accounts, validation and older message pagination',async()=>{
    const f=fixture(), {chatId}=await f.call('alice','chatStart',{peerId:'bob'});
    await f.call('bob','chatBlock',{chatId,blocked:true});
    await assert.rejects(f.call('alice','chatSend',{chatId,messageId:'one',body:'Blocked'}),e=>e.status===403);
    await f.call('alice','chatBlock',{chatId,blocked:false});
    assert.equal((await f.call('alice','chatMessages',{chatId})).blocked,true);
    await f.call('bob','chatBlock',{chatId,blocked:false});
    for(let i=0;i<45;i++){f.tick();await f.call('alice','chatSend',{chatId,messageId:'m'+i,body:'Message '+i});}
    const first=await f.call('bob','chatMessages',{chatId}),second=await f.call('bob','chatMessages',{chatId,cursor:first.nextCursor});
    assert.equal(first.messages.length,40);assert.equal(second.messages.length,5);assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,45);
    await assert.rejects(f.call('bob','chatDelete',{chatId,messageId:'m44'}),e=>e.status===403);
    await f.call('alice','chatDelete',{chatId,messageId:'m44'});
    assert.equal((await f.call('bob','chatMessages',{chatId})).messages[0].body,'');
    assert.equal((await f.call('bob','chatInbox')).items[0].preview,'삭제된 메시지입니다.');
    await assert.rejects(f.call('alice','chatSend',{chatId,messageId:'empty',body:' '}),e=>e.status===400);
    await assert.rejects(f.call('alice','chatSend',{chatId,messageId:'long',body:'x'.repeat(4001)}),e=>e.status===400);
    await assert.rejects(f.call('alice','chatMessages',{chatId,cursor:['bad','id']}),e=>e.status===400);
    f.rows.set('communityMembers/bob',{active:false,withdrawalStatus:'pending'});
    await assert.rejects(f.call('bob','chatInbox'),e=>e.status===403);
    await assert.rejects(f.call('alice','chatMessages',{chatId}),e=>e.status===403);
    f.tick();await assert.rejects(f.call('alice','chatSend',{chatId,messageId:'after',body:'Hidden'}),e=>e.status===403);
    assert.equal((await f.call('alice','chatInbox')).items.length,0);
});
test('request kinds are limited to service and making rooms',async()=>{
    const {supportsCommunityRequests,isCommunityRoomVisible}=require('../lib/community-model');
    for(const id of ['lifeup','bizup','kakao','routines','development','widgets','budget'])assert.ok(supportsCommunityRequests(id),id);
    for(const id of ['notion','gtd','secondbrain','ai-automation','requests','hello','questions','announcements'])assert.equal(supportsCommunityRequests(id),false,id);
    assert.equal(isCommunityRoomVisible('requests'),false);
    assert.equal(isCommunityRoomVisible('widgets'),true);
    assert.equal(isCommunityRoomVisible('budget'),true);
    const f=fixture();
    for(const roomId of ['hello','notion','questions'])await assert.rejects(f.call('alice','savePost',{postId:'test-'+roomId,roomId,kind:'request',title:'Title',body:'Body',version:0}),e=>e.status===400);
});
