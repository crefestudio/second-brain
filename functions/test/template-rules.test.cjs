const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Firestore permits planner routine settings but denies restricted agent activation and scrapbook habits',
    { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
        const admin = require('firebase-admin');
        const { initializeApp, deleteApp } = require('firebase/app');
        const { getFirestore, connectFirestoreEmulator, doc, setDoc, terminate } = require('firebase/firestore');
        const projectId = 'demo-planner';
        const server = admin.initializeApp({ projectId }, 'planner-rule-test');
        const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
        try {
            for (const templateId of ['lifeUp', 'lifeUpScrapbook', 'lifeupPlanner']) {
                const uid = 'rules-' + templateId;
                await server.firestore().doc('appAccounts/' + uid).set({ userId: uid });
                await server.firestore().doc('users/' + uid).set({ firebaseUid: uid, templateId });
                const client = initializeApp({ projectId, apiKey: 'demo-key' }, uid);
                const firestore = getFirestore(client);
                connectFirestoreEmulator(firestore, host, Number(port), { mockUserToken: { sub: uid } });
                try {
                    for (const agentId of ['kakao-capture', 'routine', 'secondbrain']) {
                        const write = () => setDoc(doc(firestore, 'users', uid, 'integrations', agentId), { enabled: true, updatedAt: new Date() });
                        const allowed = agentId === 'kakao-capture' || templateId === 'lifeUp' || (templateId === 'lifeupPlanner' && agentId === 'routine');
                        if (allowed) await write();
                        else await assert.rejects(write(), error => error.code === 'permission-denied');
                    }
                    const habit = { name: 'test habit', categories: [], days: [], time: '09:00', duration: 5, notify: false, goalId: '', status: '진행 중', createdAt: new Date(), updatedAt: new Date() };
                    const writeHabit = () => setDoc(doc(firestore, 'users', uid, 'integrations', 'routine', 'habits', 'test'), habit);
                    if (templateId === 'lifeUpScrapbook') await assert.rejects(writeHabit(), error => error.code === 'permission-denied');
                    else await writeHabit();
                } finally { await terminate(firestore); await deleteApp(client); }
            }
        } finally { await server.delete(); }
    });
