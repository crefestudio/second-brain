const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createKakaoQueue } = require('../lib/kakao-queue');

function fixture(process) {
    const records = new Map();
    let serial = Promise.resolve(), id = 0, time = 1000;
    const snapshot = ref => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => records.get(ref.path) });
    const update = (ref, data) => records.set(ref.path, { ...records.get(ref.path), ...data });
    const collection = path => ({
        doc(key = String(++id)) {
            const ref = { id: key, path: `${path}/${key}`, update: async data => update(ref, data) };
            return ref;
        },
        where(field, op, value) {
            assert.equal(op, '==');
            return { get: async () => ({ docs: [...records.entries()]
                .filter(([key, row]) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/') && row[field] === value)
                .map(([key]) => snapshot(collection(path).doc(key.slice(path.length + 1)))) }) };
        }
    });
    const db = { collection, runTransaction(fn) {
        const result = serial.then(() => fn({ get: async ref => snapshot(ref),
            create: (ref, data) => { assert(!records.has(ref.path)); records.set(ref.path, data); },
            update, set: (ref, data) => update(ref, data) }));
        serial = result.catch(() => {});
        return result;
    } };
    const queue = createKakaoQueue(db, process, () => time);
    const job = (uid, id) => records.get(`users/${uid}/integrations/kakao-capture/webhook_queue/${id}`);
    return { queue, records, job, advance: ms => { time += ms; } };
}

test('slow first job holds later jobs; concurrent triggers never process twice', async () => {
    let release, entered;
    const gate = new Promise(r => { release = r; });
    const started = new Promise(r => { entered = r; });
    const seen = [];
    const f = fixture(async (uid, job) => { seen.push(job.text); if (job.text === 'one') { entered(); await gate; } });
    const a = await f.queue.enqueue('a', { text: 'one' });
    assert.equal(a.waiting, false);
    const running = f.queue.drain('a');
    await started;
    const b = await f.queue.enqueue('a', { text: 'two' });
    const c = await f.queue.enqueue('a', { text: 'three' });
    assert.equal(b.waiting, true);
    await Promise.all([f.queue.drain('a'), f.queue.drain('a')]);
    assert.deepEqual(seen, ['one']);
    assert.equal(f.job('a', b.id).status, 'pending');
    release(); await running;
    assert.deepEqual(seen, ['one', 'two', 'three']);
    for (const row of [a, b, c]) assert.equal(f.job('a', row.id).status, 'done');
    await f.queue.drain('a');
    assert.equal(seen.length, 3);
    assert.equal((await f.queue.enqueue('a', { text: 'four' })).waiting, false);
});

test('failure remains visible and the following job still runs', async () => {
    const f = fixture(async (uid, job) => { if (job.fail) throw new Error('NOTION_FAILED'); });
    const a = await f.queue.enqueue('a', { fail: true });
    const b = await f.queue.enqueue('a', {});
    await f.queue.drain('a');
    assert.equal(f.job('a', a.id).status, 'error');
    assert.match(f.job('a', a.id).error, /NOTION_FAILED/);
    assert.equal(f.job('a', b.id).status, 'done');
});

test('recovery does not repeat an interrupted write and resumes waiting work', async () => {
    const seen = [];
    const f = fixture(async (uid, job, id) => seen.push(id));
    const a = await f.queue.enqueue('a', {});
    const b = await f.queue.enqueue('a', {});
    f.job('a', a.id).status = 'processing';
    Object.assign(f.records.get('kakaoQueueWorkers/a'), { owner: 'dead', leaseUntil: 2000 });
    await f.queue.recover(); assert.deepEqual(seen, []);
    f.advance(2000); await f.queue.recover();
    assert.equal(f.job('a', a.id).error, 'INTERRUPTED_REQUIRES_REVIEW');
    assert.deepEqual(seen, [b.id]);
});

test('users run independently and a missed trigger is recovered', async () => {
    let release, entered;
    const gate = new Promise(r => { release = r; });
    const started = new Promise(r => { entered = r; });
    const f = fixture(async uid => { if (uid === 'a') { entered(); await gate; } });
    await f.queue.enqueue('a', {});
    const b = await f.queue.enqueue('b', {});
    const running = f.queue.drain('a'); await started;
    await f.queue.recover();
    assert.equal(f.job('b', b.id).status, 'done');
    release(); await running;
});

test('bounded worker leaves remaining work for the recovery worker', async () => {
    const f = fixture(async () => f.advance(250000));
    const a = await f.queue.enqueue('a', {});
    const b = await f.queue.enqueue('a', {});
    await f.queue.drain('a');
    assert.equal(f.job('a', a.id).status, 'done');
    assert.equal(f.job('a', b.id).status, 'pending');
    assert.equal(f.records.get('kakaoQueueWorkers/a').active, true);
    await f.queue.recover();
    assert.equal(f.job('a', b.id).status, 'done');
});
