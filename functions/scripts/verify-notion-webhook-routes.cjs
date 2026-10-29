// Read-only production routing audit. Does not invoke AI or write Notion pages.
const path = require('node:path');
const { Firestore } = require('@google-cloud/firestore');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
const api = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/api'));
const { createNotionWebhookRouting, notionRoutingId } = require('../lib/notion-webhook-routing');
(async () => {
    const a = auth.getGlobalDefaultAccount();
    const db = new Firestore({ projectId: 'notionable-secondbrain', credentials: {
        type: 'authorized_user', client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: a.tokens.refresh_token
    } });
    const router = createNotionWebhookRouting(db, async () => { throw Error('Per-event Notion lookup must not occur'); });
    const [routes, states, events] = await Promise.all([
        db.collection('notionWebhookRoutes').get(), db.collection('notionWebhookRouteOwners').get(),
        db.collection('notionWebhookInbox').orderBy('receivedAt', 'desc').limit(100).select('event', 'status', 'lastErrorCode').get()
    ]);
    const routeMap = new Map(routes.docs.map(d => [d.id, d.data()]));
    let missing = 0, checked = 0;
    for (const state of states.docs) {
        for (const key of state.data().keys || []) {
            checked++;
            if (!routeMap.get(key)?.owners?.[state.id]) missing++;
        }
    }
    const counts = {}, storedStates = {};
    for (const doc of events.docs) {
        const data = doc.data(); storedStates[data.status] = (storedStates[data.status] || 0) + 1;
        let outcome;
        try { await router.resolve(data.event); outcome = 'matched'; }
        catch (error) { outcome = error.message; }
        counts[outcome] = (counts[outcome] || 0) + 1;
    }
    // Exercise a real indexed page without needing an event or modifying it.
    const page = routes.docs.find(d => d.id.startsWith('page_') && Object.keys(d.data().owners || {}).length === 1);
    let pageLookup;
    if (page) {
        try { await router.resolve({ entity: { id: notionRoutingId(page.id.slice(5)) } }); pageLookup = 'matched'; }
        catch (error) { pageLookup = error.message; }
    }
    console.log(JSON.stringify({ routes: routes.size, ownerRecords: states.size, checkedAliases: checked, missing,
        recentEvents: events.size, routingOutcomes: counts, storedStates, pageLookup }));
    await db.terminate();
    if (missing) throw Error('Routing index is incomplete');
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
