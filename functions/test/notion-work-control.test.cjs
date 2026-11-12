const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotionRequestControl } = require('../lib/notion-request-control');
const { createNotionPageWork } = require('../lib/notion-page-work');

function fixture() {
    const records = new Map();
    let tail = Promise.resolve();
    const snapshot = ref => ({ ref: { ...ref, get: async () => snapshot(ref) }, data: () => records.get(ref.path) });
    const collection = name => ({ doc: id => ({ path: name + '/' + id }), where: (_field, _op, time) => ({
        orderBy() { return this; }, limit() { return this; },
        get: async () => ({ docs: [...records.keys()].filter(key => key.startsWith(name + '/') && records.get(key).nextAt <= time).map(path => snapshot({ path })) })
    }) });
    const db = { collection, runTransaction: fn => {
        const next = tail.then(() => fn({ get: async ref => snapshot(ref), set: (ref, data, opts) => {
            records.set(ref.path, opts?.merge ? { ...records.get(ref.path), ...data } : data);
        }, delete: ref => records.delete(ref.path), update: (ref, data) => {
            const value = { ...records.get(ref.path), ...data };
            for (const [key, item] of Object.entries(value)) if (item?.constructor?.name === 'DeleteTransform') delete value[key];
            records.set(ref.path, value);
        } }));
        tail = next.catch(() => {}); return next;
    } };
    return { db, records };
}

test('separate API clients share request spacing and Retry-After cooldown', async () => {
    const f = fixture(); let now = 1000; const calls = []; let count = 0;
    const transport = async () => { calls.push(now); return ++count === 1 ? new Response('', { status: 429, headers: { 'retry-after': '2' } }) : new Response('{}'); };
    const first = createNotionRequestControl(f.db, transport, () => now, async ms => { now += ms; });
    const second = createNotionRequestControl(f.db, transport, () => now, async ms => { now += ms; });
    const init = { headers: { Authorization: 'Bearer fake' } };
    await first('https://api.notion.com/v1/pages/p', init);
    await second('https://api.notion.com/v1/pages/q', init);
    assert.ok(calls[1] - calls[0] >= 2000);
    assert.ok(calls[2] - calls[1] >= 650);
    assert.equal(f.records.size, 1);
    assert.ok(!JSON.stringify([...f.records]).includes('Bearer fake'));
});

test('long Retry-After blocks other clients without sleeping past execution budget', async () => {
    const f = fixture(); let now = 1000, calls = 0;
    const request = createNotionRequestControl(f.db, async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '300' } }); }, () => now, async ms => { now += ms; });
    assert.equal((await request('https://api.notion.com/v1/pages/p', { headers: { Authorization: 'Bearer t' } })).status, 429);
    await assert.rejects(request('https://api.notion.com/v1/pages/q', { headers: { Authorization: 'Bearer t' } }), /NOTION_RATE_WAIT/);
    assert.equal(calls, 1);
});

test('queue coalesces a page and keeps a newer edit arriving during processing', async () => {
    const f = fixture(), work = createNotionPageWork(f.db);
    const event = time => ({ timestamp: new Date(time).toISOString(), entity: { id: 'page' } });
    const id = await work.enqueue('u', 'c', event(1000));
    await work.enqueue('u', 'c', event(2000));
    assert.equal([...f.records.keys()].filter(k => k.startsWith('notionPageWork/')).length, 1);
    f.records.get('notionPageWork/' + id).nextAt = 0;
    await work.drain(async item => { assert.equal(item.eventTime, 2000); await work.enqueue('u', 'c', event(3000)); });
    assert.equal(f.records.get('notionPageWork/' + id).status, 'pending');
    assert.equal(f.records.get('notionPageWork/' + id).eventTime, 3000);
    f.records.get('notionPageWork/' + id).nextAt = 0;
    await work.drain(async () => {});
    assert.equal(f.records.get('notionPageWork/' + id).status, 'completed');
    assert.equal(f.records.get('notionPageWork/' + id).nextAt, undefined);
});

test('a running batch prevents webhook work and connection changes terminate it', async () => {
    const f = fixture(), work = createNotionPageWork(f.db);
    const claim = await work.acquire('u'); assert.ok(claim);
    assert.equal(await work.acquire('u'), null);
    const id = await work.enqueue('u', 'c', { timestamp: new Date().toISOString(), entity: { id: 'p' } });
    f.records.get('notionPageWork/' + id).nextAt = 0;
    await work.drain(async () => assert.fail('must not overlap batch'));
    await work.release('u', claim);
    f.records.get('notionPageWork/' + id).nextAt = 0;
    await work.drain(async () => { throw Error('NOTION_CONNECTION_CHANGED'); });
    assert.equal(f.records.get('notionPageWork/' + id).status, 'discarded');
    assert.equal(f.records.get('notionPageWork/' + id).nextAt, undefined);
});

test('temporary failures retain work with delayed retries', async () => {
    const f = fixture(), work = createNotionPageWork(f.db);
    const id = await work.enqueue('u', 'c', { timestamp: new Date().toISOString(), entity: { id: 'p' } });
    f.records.get('notionPageWork/' + id).nextAt = 0;
    await work.drain(async () => { throw Object.assign(Error('rate_limited'), { status: 429 }); });
    const item = f.records.get('notionPageWork/' + id);
    assert.equal(item.status, 'retry'); assert.equal(item.attempts, 1);
    assert.ok(item.nextAt > Date.now() + 59000);
});
