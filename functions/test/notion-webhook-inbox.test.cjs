const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
function fixture() {
    const records = new Map();
    let failWrite = false;
    const ref = id => ({ id, create: async value => {
        if (failWrite) throw { code: 7 };
        if (records.has(id)) throw { code: 6 };
        records.set(id, value);
    } });
    const db = { collection: () => ({ doc: ref }), runTransaction: async fn => fn({
        get: async r => ({ data: () => records.get(r.id) }),
        update: (r, patch) => records.set(r.id, { ...records.get(r.id), ...patch }),
    }) };
    const context = { exports: {}, db, crypto, randomUUID: crypto.randomUUID,
        ...require('../lib/notion-webhook-routing'), notionWebhookRouting: { requeueWaiting: async () => false },
        onRequest: (_, fn) => fn, withCors: fn => fn, onDocumentCreated: (_, fn) => fn,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
        console: { error() {}, log() {} }, Date };
    vm.createContext(context);
    const section = source.slice(source.indexOf('export const handleNotionWebhookSinglePage ='), source.indexOf('async function processNotionWebhookDelivery('));
    vm.runInContext(ts.transpileModule(section, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    context.processNotionWebhookDelivery = async () => {};
    const request = async (event = { id: 'event1', type: 'page.created', entity: { id: 'page1' } }) => {
        const res = { status(n) { this.code = n; return this; }, send(body) { this.body = body; return this; } };
        await context.exports.handleNotionWebhookSinglePage({ method: 'POST', body: event }, res);
        return res;
    };
    const work = () => context.exports.processNotionWebhookInbox({ data: { ref: ref([...records.keys()][0]) }, params: { eventId: 'event1' } });
    return { records, context, request, work, failWrites: () => { failWrite = true; } };
}
test('acknowledges only durable storage and does not run Notion inline', async () => {
    const f = fixture();
    f.context.processNotionWebhookDelivery = () => assert.fail('inline processing');
    assert.equal((await f.request()).code, 200);
    assert.equal([...f.records.values()][0].status, 'pending');
});
test('duplicate delivery preserves existing state', async () => {
    const f = fixture(); await f.request(); await f.work();
    assert.equal((await f.request()).code, 200);
    assert.equal(f.records.size, 1);
    assert.equal([...f.records.values()][0].status, 'completed');
});
test('Firestore write failure is not acknowledged', async () => {
    const f = fixture(); f.failWrites();
    assert.equal((await f.request()).code, 503);
    assert.equal(f.records.size, 0);
});
test('unmatched events are retained once without repeated searches', async () => {
    const f = fixture(); await f.request();
    f.context.processNotionWebhookDelivery = async () => { throw new Error('NO_MATCHING_WORKSPACE'); };
    await f.work();
    const item = [...f.records.values()][0];
    assert.equal(item.status, 'waiting_mapping');
    assert.equal(item.attempts, 1);
    assert.equal(item.lastErrorCode, 'NO_MATCHING_WORKSPACE');
    assert.ok(item.event);
    await f.work(); assert.equal([...f.records.values()][0].attempts, 1);
});

test('temporary provider errors still retry and stop at the existing limit', async () => {
    const f = fixture(); await f.request();
    f.context.processNotionWebhookDelivery = async () => { throw new Error('RATE_LIMITED'); };
    for (let i = 0; i < 9; i++) await assert.rejects(f.work(), /NOTION_WEBHOOK_RETRY/);
    await f.work();
    assert.equal([...f.records.values()][0].status, 'needs_attention');
    assert.equal([...f.records.values()][0].attempts, 10);
});

test('ambiguous ownership is retained for review without retrying or writing Notion', async () => {
    const f = fixture(); await f.request();
    f.context.processNotionWebhookDelivery = async () => { throw new Error('AMBIGUOUS_WEBHOOK_WORKSPACE'); };
    await f.work(); await f.work();
    assert.equal([...f.records.values()][0].status, 'needs_attention');
    assert.equal([...f.records.values()][0].attempts, 1);
});
test('completed event is not processed again', async () => {
    const f = fixture(); let calls = 0; await f.request();
    f.context.processNotionWebhookDelivery = async () => { calls++; };
    await f.work(); await f.work(); assert.equal(calls, 1);
});
test('verification and unsupported events create no processing records', async () => {
    const f = fixture();
    assert.equal((await f.request({ verification_token: 'verification' })).code, 200);
    assert.equal((await f.request({ type: 'unsupported' })).code, 200);
    assert.equal(f.records.size, 0);
});
