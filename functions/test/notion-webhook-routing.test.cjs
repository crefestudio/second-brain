const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotionWebhookRouting, notionRoutingId } = require('../lib/notion-webhook-routing');
const database = '11111111-1111-1111-1111-111111111111';
const source = '22222222-2222-2222-2222-222222222222';
const page = '33333333-3333-3333-3333-333333333333';
const other = '44444444-4444-4444-4444-444444444444';
const event = (parent = source) => ({ id: 'event', entity: { id: page }, data: { parent: { data_source_id: parent } } });
function fixture() {
    const records = new Map(), reads = [];
    let lookups = 0;
    const snap = p => ({ id: p.split('/').at(-1), ref: ref(p), exists: records.has(p), data: () => records.get(p) });
    const query = (p, field, value) => ({
        orderBy() { return this; }, limit() { return this; }, startAfter() { return this; },
        async get() {
            assert.equal(p, 'notionWebhookInbox', 'No collection scan is allowed');
            const docs = [...records.keys()].filter(k => k.startsWith(p + '/') && records.get(k)[field]?.includes?.(value)).map(snap);
            return { docs, size: docs.length };
        }
    });
    function ref(p) { return { path: p, id: p.split('/').at(-1), collection: n => ref(p + '/' + n), doc: n => ref(p + '/' + n),
        where: (field, _op, value) => query(p, field, value),
        get: async () => { reads.push(p); assert.ok(p.includes('/'), 'No collection scan'); return snap(p); }
    }; }
    const write = (r, data, merge) => {
        const next = merge ? { ...(records.get(r.path) || {}), ...data } : { ...data };
        for (const [key, value] of Object.entries(next)) if (value?.constructor?.name === 'DeleteTransform') delete next[key];
        records.set(r.path, next);
    };
    const db = { collection: n => ref(n), runTransaction: async fn => {
        const writes = [];
        const result = await fn({ get: async r => { reads.push(r.path); return snap(r.path); },
            set: (r, data, opts) => writes.push(() => write(r, data, opts?.merge)),
            update: (r, data) => writes.push(() => write(r, data, true)),
            create: (r, data) => writes.push(() => { assert.ok(!records.has(r.path)); write(r, data); }) });
        writes.forEach(fn => fn()); return result;
    } };
    const router = createNotionWebhookRouting(db, async () => { lookups++; return [source]; });
    function connect(uid = 'u', version = 'v1') {
        records.set(`users/${uid}`, { notionAccessToken: 'token-' + uid, notionConnectionId: version, notionConnection: { status: 'connected' } });
        records.set(`users/${uid}/integrations/secondbrain`, { accessToken: 'token-' + uid, connectionId: version, noteDatabaseId: database });
    }
    connect();
    return { router, records, reads, connect, ref, lookups: () => lookups };
}

test('database and data source aliases route with bounded direct reads, no Notion calls per event', async () => {
    const f = fixture(); await f.router.syncConnection('u');
    f.reads.length = 0;
    for (const id of [database, source, source.replaceAll('-', '').toUpperCase()]) assert.equal((await f.router.resolve(event(id))).userId, 'u');
    assert.equal(f.lookups(), 1);
    assert.equal(f.reads.length, 12); // two routing keys plus the owner and integration
});

test('unknown events never enumerate users or call Notion', async () => {
    const f = fixture();
    await assert.rejects(f.router.resolve(event()), /NO_MATCHING_WORKSPACE/);
    assert.equal(f.reads.length, 2); assert.equal(f.lookups(), 0);
});

test('shared databases retain every owner and refuse ambiguous routing', async () => {
    const f = fixture(); f.connect('other');
    await f.router.syncConnection('u'); await f.router.syncConnection('other');
    await assert.rejects(f.router.resolve(event()), /AMBIGUOUS_WEBHOOK_WORKSPACE/);
    f.records.get('users/other').notionConnection.status = 'disconnected';
    assert.equal((await f.router.resolve(event())).userId, 'u');
    await f.router.syncConnection('other');
    assert.deepEqual(Object.keys(f.records.get('notionWebhookRoutes/parent_' + notionRoutingId(source)).owners), ['u']);
});

test('reconnecting cannot use routes from a previous connection', async () => {
    const f = fixture(); await f.router.syncConnection('u'); f.connect('u', 'v2');
    await assert.rejects(f.router.resolve(event()), /NO_MATCHING_WORKSPACE/);
    await f.router.syncConnection('u'); assert.equal((await f.router.resolve(event())).connectionId, 'v2');
});

test('page routes preserve moved/deleted/parentless pages and expire on reconnection', async () => {
    const f = fixture(); f.records.set(`users/u/integrations/secondbrain/pages/${page}`, { active: false, routingConnectionId: 'v1' });
    await f.router.syncPage('u', page);
    assert.equal((await f.router.resolve(event(other))).userId, 'u');
    assert.equal((await f.router.resolve({ entity: { id: page } })).userId, 'u');
    f.connect('u', 'v2'); await assert.rejects(f.router.resolve(event(other)), /NO_MATCHING_WORKSPACE/);
    assert.equal(await f.router.syncPage('u', page), false);
});

test('legacy pages require explicit backfill; newer routing versions are never overridden', async () => {
    const f = fixture(); const p = `users/u/integrations/secondbrain/pages/${page}`;
    f.records.set(p, { keywords: ['keep'] });
    assert.equal(await f.router.syncPage('u', page), false);
    assert.equal(await f.router.syncPage('u', page, true), true);
    assert.deepEqual(f.records.get(p), { keywords: ['keep'] });
    f.records.set(p, { routingConnectionId: 'old' });
    assert.equal(await f.router.syncPage('u', page, true), false);
});

test('a connection changing during data source discovery cannot write stale routes', async () => {
    const f = fixture();
    const db = { collection: n => f.ref(n), runTransaction: async fn => fn({ get: r => r.get(), set: () => assert.fail('stale write') }) };
    const router = createNotionWebhookRouting(db, async () => { f.connect('u', 'v2'); return [source]; });
    await assert.rejects(router.syncConnection('u'), /NOTION_CONNECTION_CHANGED/);
});

test('repair replays only matching deferred events once and retains their originals', async () => {
    const f = fixture(); const original = 'notionWebhookInbox/original';
    f.records.set(original, { event: event(), status: 'waiting_mapping', attempts: 1, waitingRouteKeys: ['parent_' + notionRoutingId(source)] });
    assert.equal(await f.router.requeueWaiting(f.ref(original)), false);
    await f.router.syncConnection('u');
    assert.equal(await f.router.replayForRoute('parent_' + notionRoutingId(source)), 1);
    assert.equal(await f.router.replayForRoute('parent_' + notionRoutingId(source)), 0);
    const saved = f.records.get(original); assert.equal(saved.status, 'replay_queued'); assert.ok(saved.event);
    const retry = f.records.get('notionWebhookInbox/' + saved.replayId);
    assert.equal(retry.status, 'pending'); assert.equal(retry.attempts, 0); assert.equal(retry.replayOf, 'original');
});

test('invalid identifiers never become arbitrary Firestore paths', async () => {
    const f = fixture(); await assert.rejects(f.router.resolve({ entity: { id: '../users' } }), /INVALID_WEBHOOK_IDS/);
    assert.equal(f.reads.length, 0);
});

test('all connected template databases are indexed, not just the original note parent', async () => {
    const f = fixture();
    f.records.get('users/u').notionConnection.databases = { note: database, memo: other };
    await f.router.syncConnection('u');
    assert.equal((await f.router.resolve(event(other))).userId, 'u');
    assert.equal(f.lookups(), 2);
});

test('unauthorized and missing Notion resources are retained without a retry loop', () => {
    const { deferredWebhookStatus } = require('../lib/notion-webhook-routing');
    for (const status of [401, 403, 404]) assert.equal(deferredWebhookStatus({ status }), 'needs_attention');
    for (const status of [429, 500, 503]) assert.equal(deferredWebhookStatus({ status }), null);
});
