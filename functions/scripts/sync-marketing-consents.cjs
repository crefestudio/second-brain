// Run from the repository root after `npm --prefix functions run build`.
// Uses the existing Firebase CLI login in memory; never writes credentials.
const path = require('node:path');
const {Firestore} = require('@google-cloud/firestore');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
const api = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/api.js'));
const {migrateMarketingConsents, syncImwebMarketingConsents} = require('../lib/imweb-marketing-consent');
const {legacyConsentPatch} = require('../lib/marketing-consent');
const project = 'notionable-secondbrain';
(async () => {
    const account = auth.getGlobalDefaultAccount();
    async function credentials() {
        const result = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
        return {access_token:result.access_token, expires_in:3600};
    }
    const db = new Firestore({projectId:project, credentials:{type:'authorized_user',client_id:api.clientId(),client_secret:api.clientSecret(),refresh_token:account.tokens.refresh_token}});
    for (const name of ['appAccounts', 'customers']) {
        const docs = await db.collection(name).get();
        console.log(JSON.stringify({collection:name,total:docs.size,toMigrate:docs.docs.filter(doc => Object.keys(legacyConsentPatch(doc.data())).length).length}));
    }
    if (!process.argv.includes('--apply')) return;
    const migrated = await migrateMarketingConsents(db);
    console.log(JSON.stringify({migrated}));
    const {access_token:t} = await credentials();
    async function secret(name) {
        const r = await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}/versions/latest:access`, {headers:{Authorization:`Bearer ${t}`}});
        if (!r.ok) throw Error(`Secret access failed (${r.status})`);
        return Buffer.from((await r.json()).payload.data, 'base64').toString().trim();
    }
    const [key,value] = await Promise.all([secret('IMWEB_API_KEY'),secret('IMWEB_API_SECRET')]);
    const response = await fetch('https://api.imweb.me/v2/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,secret:value})});
    const payload = await response.json();
    if (!payload.access_token) throw Error('Imweb authentication failed');
    console.log(JSON.stringify(await syncImwebMarketingConsents(db, payload.access_token)));
    for (const name of ['appAccounts', 'customers']) {
        const docs = await db.collection(name).get();
        const remaining = docs.docs.filter(doc => Object.keys(legacyConsentPatch(doc.data())).length).length;
        console.log(JSON.stringify({collection:name,remainingLegacy:remaining}));
        if (remaining) throw Error('Migration verification failed');
    }
})().catch(error => {console.error(error.message);process.exitCode=1;});
