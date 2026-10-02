const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMailQueue, hasMailCapacity, nextMailMorning } = require('../lib/mail-queue');
const { FieldValue } = require('firebase-admin/firestore');

function fixture(provider = async () => ({ data: { id: 'provider-id' }, error: null }), allowed = true) {
    const records = new Map();
    let chain = Promise.resolve();
    const snap = ref => ({ exists: records.has(ref.path), data: () => records.get(ref.path) });
    const write = (ref, data, merge) => {
        const next = { ...(merge ? records.get(ref.path) : {}), ...data };
        for (const key of Object.keys(next)) if (next[key] instanceof FieldValue) delete next[key];
        records.set(ref.path, next);
    };
    const db = {
        collection: name => ({ doc: id => ({ id, path: name + '/' + id }) }),
        runTransaction(callback) {
            const result = chain.then(() => callback({ get: async ref => snap(ref),
                create: (ref, data) => { assert(!records.has(ref.path)); write(ref, data); },
                set: (ref, data, options) => write(ref, data, options?.merge), update: (ref, data) => write(ref, data, true) }));
            chain = result.catch(() => {});
            return result;
        }
    };
    let calls = 0;
    const keys = [];
    const queue = createMailQueue(db, async (mail, key) => { calls++; keys.push(key); return provider(mail, key); }, async () => allowed);
    return { queue, records, keys, calls: () => calls,
        unlock: () => records.set('mailQueueControl/sender', { leaseUntil: 0, nextSendAt: 0 }),
        row: id => records.get('mailQueue/' + id) };
}
const mail = { from: 'test@example.com', to: 'user@example.com', subject: 'test', text: 'body' };

test('normal mail has a fixed 70 limit while high mail uses the remaining total limit', () => {
    assert.equal(hasMailCapacity({ normal: 70 }, 'normal'), false);
    assert.equal(hasMailCapacity({ normal: 70 }, 'critical'), true);
    assert.equal(hasMailCapacity({ normal: 70 }, 'high'), true);
    assert.equal(hasMailCapacity({ high: 99 }, 'high'), true);
    assert.equal(hasMailCapacity({ high: 100 }, 'high'), false);
    assert.equal(hasMailCapacity({ high: 30, normal: 70 }, 'high'), false);
});
test('full pool resumes at Korean 10am next accounting day', () => {
    assert.equal(new Date(nextMailMorning(Date.parse('2026-09-29T03:00:00Z'))).toISOString(), '2026-09-30T01:00:00.000Z');
});
test('a campaign can retain an explicit recipient order in the queue', async () => {
    const f = fixture();
    const firstAt = Date.now() + 5000;
    const [first] = await f.queue.enqueue(mail, 'normal', 'campaign-order-first', false, firstAt, 1);
    const [second] = await f.queue.enqueue({ ...mail, to: 'second@example.com' }, 'normal', 'campaign-order-second', false, firstAt + 1, 2);
    assert.equal(f.row(first).queueOrder, 1);
    assert.equal(f.row(second).queueOrder, 2);
    assert(f.row(first).nextAttemptAt < f.row(second).nextAttemptAt);
});
test('repeated queue requests and concurrent workers send only once', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.queue.enqueue(mail, 'normal', 'same'), f.queue.enqueue(mail, 'normal', 'same')]);
    assert.deepEqual(a, b);
    await Promise.all([f.queue.attempt(a[0]), f.queue.attempt(a[0])]);
    assert.equal(f.calls(), 1);
    assert.equal(f.row(a[0]).status, 'sent');
    assert.equal(f.row(a[0]).mail, undefined);
});
test('133 manual recipients send 70 and retain 63 for tomorrow', async () => {
    const f = fixture();
    const ids = [];
    for (let i = 0; i < 133; i++) {
        const [id] = await f.queue.enqueue({ ...mail, to: `user${i}@example.com` }, 'normal', 'campaign');
        ids.push(id); f.unlock(); await f.queue.attempt(id);
    }
    assert.equal(f.calls(), 70);
    assert.equal(ids.filter(id => f.row(id).status === 'pending').length, 63);
    assert(ids.slice(70).every(id => f.row(id).nextAttemptAt > Date.now()));
    f.unlock();
    const [secondHigh] = await f.queue.enqueue({ ...mail, to: 'high-second@example.com' }, 'high');
    assert.equal(await f.queue.attempt(secondHigh), 'sent');
    f.unlock();
    const [high] = await f.queue.enqueue(mail, 'high');
    assert.equal(await f.queue.attempt(high), 'sent');
});
test('ambiguous provider failure retries same key without spending quota twice', async () => {
    let first = true;
    const f = fixture(async () => { if (first) { first = false; throw Error('network'); } return { data: { id: 'ok' }, error: null }; });
    const [id] = await f.queue.enqueue(mail, 'normal');
    assert.equal(await f.queue.attempt(id), 'pending');
    f.row(id).nextAttemptAt = 0; f.unlock();
    assert.equal(await f.queue.attempt(id), 'sent');
    assert.equal(f.keys[0], f.keys[1]);
    assert.equal([...f.records.entries()].find(([key]) => key.startsWith('mailDailyUsage/'))[1].normal, 1);
});
test('provider daily rejection retains queued email and pauses sender', async () => {
    const f = fixture(async () => ({ data: null, error: { message: 'Daily sending limit reached', statusCode: 429 } }));
    const [id] = await f.queue.enqueue(mail, 'normal');
    await f.queue.attempt(id);
    assert.equal(f.row(id).status, 'pending');
    assert(f.row(id).nextAttemptAt > Date.now());
    assert(f.records.get('mailQueueControl/sender').pausedUntil > Date.now());
});
test('blocked recipients and expired authentication never reach provider', async () => {
    const f = fixture(undefined, false);
    const [id] = await f.queue.enqueue(mail, 'normal');
    assert.equal(await f.queue.attempt(id), 'cancelled');
    assert.equal(f.calls(), 0);

    const authentication = fixture();
    const [otp] = await authentication.queue.enqueue(mail, 'high', undefined, true);
    authentication.row(otp).expiresAt = Date.now() - 1;
    assert.equal(await authentication.queue.attempt(otp, true), 'expired');
    assert.equal(authentication.calls(), 0);
});
test('only pending mail can be cancelled before the provider accepts it', async () => {
    const f = fixture();
    const [id] = await f.queue.enqueue(mail, 'normal');
    assert.equal(await f.queue.cancel(id), 'cancelled');
    assert.equal(f.row(id).status, 'cancelled');
    assert.equal(await f.queue.attempt(id), 'cancelled');
    assert.equal(f.calls(), 0);
    const [sent] = await f.queue.enqueue({ ...mail, to: 'sent@example.com' }, 'normal');
    assert.equal(await f.queue.attempt(sent), 'sent');
    assert.equal(await f.queue.cancel(sent), 'sent');
});
test('uncertain sends older than provider idempotency window require review', async () => {
    const f = fixture();
    const [id] = await f.queue.enqueue(mail, 'normal');
    f.row(id).firstAttemptAt = Date.now() - 24 * 3600000;
    assert.equal(await f.queue.attempt(id), 'review');
    assert.equal(f.calls(), 0);
});
