// Dry run by default. --apply repairs only invalid times, with update-time guards.
const path = require('node:path');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
const root = 'https://firestore.googleapis.com/v1/projects/notionable-secondbrain/databases/(default)/documents';
const valid = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

(async () => {
    const account = auth.getGlobalDefaultAccount();
    if (!account) throw new Error('Firebase login required');
    const token = (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await fetch(`${root}:runQuery`, {
        method: 'POST', headers,
        body: JSON.stringify({ structuredQuery: {
            from: [{ collectionId: 'habits', allDescendants: true }],
            select: { fields: [{ fieldPath: 'time' }] }
        } })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result.error));
    const targets = result.map(row => row.document).filter(doc => doc &&
        /\/users\/[^/]+\/integrations\/routine\/habits\/[^/]+$/.test(doc.name) &&
        !valid(doc.fields?.time?.stringValue));
    console.log(JSON.stringify({ invalidCount: targets.length, apply: process.argv.includes('--apply') }));
    for (const doc of targets) {
        console.log(JSON.stringify({ document: doc.name.split('/documents/')[1], previous: doc.fields?.time ?? null, time: '09:00' }));
        if (!process.argv.includes('--apply')) continue;
        const query = new URLSearchParams({ 'updateMask.fieldPaths': 'time', 'currentDocument.updateTime': doc.updateTime });
        const updated = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?${query}`, {
            method: 'PATCH', headers, body: JSON.stringify({ fields: { time: { stringValue: '09:00' } } })
        });
        const data = await updated.json();
        if (!updated.ok) throw new Error(JSON.stringify(data.error));
        if (data.fields?.time?.stringValue !== '09:00') throw new Error('Repair verification failed');
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
