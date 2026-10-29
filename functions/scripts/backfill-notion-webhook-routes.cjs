// Read-only by default. --apply writes only routing indexes, never Notion content.
const path = require('node:path');
const { Firestore } = require('@google-cloud/firestore');
const { Client } = require('@notionhq/client');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
const api = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/api'));
const { createNotionWebhookRouting, notionRoutingId } = require('../lib/notion-webhook-routing');
const apply = process.argv.includes('--apply');
(async () => {
    const account = auth.getGlobalDefaultAccount();
    const db = new Firestore({ projectId: 'notionable-secondbrain', credentials: {
        type: 'authorized_user', client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: account.tokens.refresh_token
    } });
    const router = createNotionWebhookRouting(db, async (token, databaseId) => {
        const result = await new Client({ auth: token, logger: () => {} }).databases.retrieve({ database_id: databaseId });
        return (result.data_sources || []).map(source => source.id);
    });
    const users = await db.collection('users').get();
    const result = { apply, users: users.size, eligible: 0, pageIndexes: 0, parentIndexes: 0, skipped: 0, errors: [] };
    for (const user of users.docs) {
        const u = user.data();
        if (!u.notionAccessToken || u.deletionStatus === 'archived' || ['pending', 'failed', 'disconnected'].includes(u.notionConnection?.status)) continue;
        const ref = user.ref.collection('integrations').doc('secondbrain');
        const config = (await ref.get()).data();
        if (!config || config.accessToken !== u.notionAccessToken || !notionRoutingId(config.noteDatabaseId) ||
            (config.connectionId && config.connectionId !== u.notionConnectionId) || ['pending', 'failed', 'disconnected'].includes(config.connectionStatus)) {
            result.skipped++; continue;
        }
        result.eligible++;
        try {
            if (apply) {
                const synced = await router.syncConnection(user.id);
                result.parentIndexes += synced.keys.length;
            } else {
                const data = await new Client({ auth: u.notionAccessToken, logger: () => {} }).databases.retrieve({ database_id: config.noteDatabaseId });
                result.parentIndexes += new Set([config.noteDatabaseId, ...(data.data_sources || []).map(s => s.id)].map(notionRoutingId).filter(Boolean)).size;
            }
        } catch (error) {
            result.errors.push({ userId: user.id, code: error.code || 'ROUTING_SYNC_FAILED', status: error.status });
            // Cached-page routing still works when a parent database was moved.
        }
        if (process.argv.includes('--parents-only')) continue;
        const pages = await ref.collection('pages').select('routingConnectionId').get();
        for (const page of pages.docs) {
            if (!notionRoutingId(page.id)) continue;
            if (apply) { if (await router.syncPage(user.id, page.id, true)) result.pageIndexes++; }
            else result.pageIndexes++;
        }
        console.log(JSON.stringify({ progress: result.eligible, pageIndexes: result.pageIndexes, errors: result.errors.length }));
    }
    console.log(JSON.stringify(result));
    await db.terminate();
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
