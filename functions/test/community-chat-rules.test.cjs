const {test}=require('node:test');
const assert=require('node:assert/strict');
test('chat signal rules are self-only and content is server-only', {skip:!process.env.FIRESTORE_EMULATOR_HOST}, async()=>{
    const admin=require('firebase-admin');
    const {initializeApp,deleteApp}=require('firebase/app');
    const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,terminate}=require('firebase/firestore');
    const projectId='demo-club-chat',server=admin.initializeApp({projectId},'chat-rules');
    const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
    assert.match(host,/^(localhost|127\.0\.0\.1)$/);
    const db=server.firestore();
    await db.doc('communityMembers/alice').set({active:true});
    await db.doc('communityMembers/bob').set({active:true});
    await db.doc('communityChatSignals/alice').set({updatedAt:1});
    await db.doc('communityChatSignals/bob').set({updatedAt:1});
    await db.doc('communityChats/private').set({participants:['alice','bob']});
    const client=initializeApp({projectId,apiKey:'demo-key'},'chat-rules-client'),store=getFirestore(client);
    connectFirestoreEmulator(store,host,Number(port),{mockUserToken:{sub:'alice',email_verified:true}});
    try {
        assert.ok((await getDoc(doc(store,'communityChatSignals/alice'))).exists());
        for(const path of ['communityChatSignals/bob','communityChats/private','communityChats/private/messages/one','communityMemberPrivate/alice/chats/private']) await assert.rejects(getDoc(doc(store,path)),e=>e.code==='permission-denied');
        await assert.rejects(setDoc(doc(store,'communityChatSignals/alice'),{updatedAt:2}),e=>e.code==='permission-denied');
        await db.doc('communityMembers/alice').set({active:false,withdrawalStatus:'pending'});
        await assert.rejects(getDoc(doc(store,'communityChatSignals/alice')),e=>e.code==='permission-denied');
    }finally{await terminate(store);await deleteApp(client);await server.delete();}
});
