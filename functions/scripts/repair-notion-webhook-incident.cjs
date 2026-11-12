// Incident-specific, idempotent maintenance. Read-only unless an explicit flag is passed.
const path = require('node:path');
const { Firestore, Timestamp, FieldValue } = require('@google-cloud/firestore');
const { Client } = require('@notionhq/client');
const fb = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib');
const auth = require(path.join(fb, 'auth'));
const api = require(path.join(fb, 'api'));
const { createNotionRequestControl } = require('../lib/notion-request-control');
const { createNotionPageWork } = require('../lib/notion-page-work');
const { webhookRoutingKeys } = require('../lib/notion-webhook-routing');

(async () => {
    const a = auth.getGlobalDefaultAccount();
    const db = new Firestore({ projectId: 'notionable-secondbrain', credentials: {
        type: 'authorized_user', client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: a.tokens.refresh_token
    } });
    try {
        const users = await db.collection('users').where('email', '==', 'dodocsang@gmail.com').get();
        if (users.size !== 1) throw Error('AMBIGUOUS_ACCOUNT');
        const userDoc = users.docs[0], user = userDoc.data();
        const configRef = userDoc.ref.collection('integrations').doc('secondbrain');
        const config = (await configRef.get()).data();
        if (!config || config.connectionStatus !== 'connected' || config.enabled !== true ||
            config.accessToken !== user.notionAccessToken || config.connectionId !== user.notionConnectionId) throw Error('CONNECTION_NOT_READY');
        const state = (await db.collection('notionWebhookRouteOwners').doc(userDoc.id).get()).data();
        const activeKeys = new Set(state?.keys || []);
        const incident = await db.collection('notionWebhookInbox')
            .where('receivedAt', '>=', Timestamp.fromDate(new Date('2026-11-12T00:45:00Z')))
            .where('receivedAt', '<', Timestamp.fromDate(new Date('2026-11-12T00:47:00Z'))).get();
        const relevant = incident.docs.filter(doc => doc.data().event?.workspace_id === config.workspaceId);
        const pending = relevant.filter(doc => doc.data().status === 'waiting_mapping');
        const obsolete = pending.filter(doc => webhookRoutingKeys(doc.data().event).filter(k => k.startsWith('parent_')).every(k => !activeKeys.has(k)));
        if (process.argv.includes('--close-obsolete')) {
            if (pending.length !== obsolete.length) throw Error('INCIDENT_HAS_CURRENT_ROUTES');
            for (const doc of obsolete) await db.runTransaction(async tx => {
                const [u, c, current] = await Promise.all([tx.get(userDoc.ref), tx.get(configRef), tx.get(doc.ref)]);
                if (u.data()?.notionConnectionId !== config.connectionId || c.data()?.noteDatabaseId !== config.noteDatabaseId) throw Error('CONNECTION_CHANGED');
                if (current.data()?.status !== 'waiting_mapping') return;
                tx.update(doc.ref, { status: 'discarded', lastErrorCode: 'OBSOLETE_CONNECTION_INCIDENT_20261112',
                    waitingRouteKeys: FieldValue.delete(), leaseUntil: 0, closedAt: FieldValue.serverTimestamp() });
            });
        }
        console.log(JSON.stringify({ incidentEvents: relevant.length, pending: pending.length, obsolete: obsolete.length,
            closed: process.argv.includes('--close-obsolete') ? obsolete.length : 0 }));
        if (process.argv.includes('--close-only')) return;
        const notion = new Client({ auth: config.accessToken, fetch: createNotionRequestControl(db), retry: false, logger() {} });
        const database = await notion.databases.retrieve({ database_id: config.noteDatabaseId });
        const sources = database.data_sources || [];
        if (!sources.length) throw Error('NO_DATA_SOURCE');
        const cache = await configRef.collection('pages').get();
        const byId = new Map(cache.docs.map(doc => [doc.id.replace(/-/g, ''), doc.data()]));
        let pages = 0, missing = 0, cached = 0, queued = 0, present = 0;
        const work = createNotionPageWork(db);
        for (const source of sources) {
            let cursor;
            do {
                const result = await notion.dataSources.query({ data_source_id: source.id, page_size: 100, start_cursor: cursor });
                for (const page of result.results) {
                    if (!page.properties || page.archived || page.in_trash || page.properties['키워드']?.type !== 'multi_select') continue;
                    pages++;
                    const keywords = page.properties['키워드'].multi_select;
                    if (keywords.length) { present++; continue; }
                    const saved = byId.get(page.id.replace(/-/g, ''));
                    if (saved?.keywords?.length && saved.routingConnectionId === config.connectionId) { cached++; continue; }
                    missing++;
                    if (process.argv.includes('--enqueue-missing')) {
                        const current = (await configRef.get()).data();
                        if (current?.connectionId !== config.connectionId || current?.enabled !== true || current?.noteDatabaseId !== config.noteDatabaseId) throw Error('CONNECTION_CHANGED');
                        await work.enqueue(userDoc.id, config.connectionId, { id: 'incident-recovery-20261112-' + page.id,
                            type: 'page.content_updated', timestamp: new Date().toISOString(), entity: { id: page.id, type: 'page' },
                            workspace_id: config.workspaceId, data: { parent: { data_source_id: source.id, database_id: config.noteDatabaseId } } }, true);
                        queued++;
                    }
                }
                cursor = result.has_more ? result.next_cursor : undefined;
            } while (cursor);
        }
        console.log(JSON.stringify({ currentDatabaseId: config.noteDatabaseId, pages, keywordsPresent: present, cachedKeywords: cached, missingCandidates: missing, queued }));
    } finally { await db.terminate(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
