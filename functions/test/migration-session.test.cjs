const { test } = require('node:test');
const assert = require('node:assert/strict');
const { claimMigrationSession: claim, finishMigrationSession: finish, markMigrationConnected } = require('../lib/migration-session');

function fixture(user = {}) {
    const records = new Map([['users/u', user]]);
    const ref = path => ({ path, collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
    let queue = Promise.resolve();
    const db = {
        collection: name => ({ doc: id => ref(`${name}/${id}`) }),
        runTransaction(fn) {
            const result = queue.then(async () => {
                const writes = [];
                const tx = {
                    get: async r => ({ data: () => records.get(r.path) }),
                    set: (r, value) => writes.push(() => records.set(r.path, value)),
                    update: (r, value) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...value })),
                    delete: r => writes.push(() => records.delete(r.path))
                };
                const value = await fn(tx);
                writes.forEach(write => write());
                return value;
            });
            queue = result.catch(() => {});
            return result;
        }
    };
    return { db, records, lock: () => records.get('users/u/integrations/migrationSession') };
}
async function connected(f, mode = 'migration') {
    const c = await claim(f.db, 'u', mode, 'connect');
    await finish(f.db, c, false, true);
    return c;
}

test('simultaneous modes: exactly one transaction acquires the integration', async () => {
    const f = fixture();
    const results = await Promise.allSettled(['migration', 'templateTransfer'].map(mode => claim(f.db, 'u', mode, 'connect')));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});
test('reload and completed request retain mode; explicit disconnect allows the other mode', async () => {
    const f = fixture();
    const c = await connected(f);
    const run = await claim(f.db, 'u', 'migration', 'run');
    await finish(f.db, run);
    assert.equal(f.lock().sessionId, c.sessionId);
    await assert.rejects(claim(f.db, 'u', 'templateTransfer', 'connect'));
    const d = await claim(f.db, 'u', 'migration', 'disconnect');
    await finish(f.db, d, true);
    await claim(f.db, 'u', 'templateTransfer', 'connect');
});
test('active worker blocks reconnect, disconnect, second run and check; stop does not release it', async () => {
    const f = fixture(); await connected(f);
    const run = await claim(f.db, 'u', 'migration', 'run');
    for (const action of ['connect', 'disconnect', 'run', 'check']) await assert.rejects(claim(f.db, 'u', 'migration', action));
    const stop = await claim(f.db, 'u', 'migration', 'stop'); await finish(f.db, stop);
    assert.equal(f.lock().operationId, run.operationId);
    await finish(f.db, run);
});
test('cancelled/replaced OAuth callback is fenced; pending OAuth blocks migration', async () => {
    const f = fixture();
    const old = await claim(f.db, 'u', 'migration', 'connect'); await finish(f.db, old);
    await assert.rejects(claim(f.db, 'u', 'migration', 'run'));
    const fresh = await claim(f.db, 'u', 'migration', 'connect'); await finish(f.db, fresh);
    await assert.rejects(claim(f.db, 'u', 'migration', 'callback', old.sessionId));
    const d = await claim(f.db, 'u', 'migration', 'disconnect'); await finish(f.db, d, true);
    await assert.rejects(claim(f.db, 'u', 'migration', 'callback', fresh.sessionId));
});
test('disconnecting another mode never releases the owning session', async () => {
    const f = fixture(); const c = await connected(f);
    const other = await claim(f.db, 'u', 'templateTransfer', 'disconnect'); await finish(f.db, other, true);
    assert.equal(f.lock().mode, 'migration');
    assert.equal(f.lock().sessionId, c.sessionId);
});
test('old connections and active pre-deployment workers are respected', async () => {
    const f = fixture({ notionMigrationAccessToken: 'old' });
    await assert.rejects(claim(f.db, 'u', 'templateTransfer', 'connect'));
    f.records.set('users/u/integrations/migration', { migrationRunId: 'run' });
    f.records.set('users/u/integrations/migration/migration/run', { status: 'migrating', updatedAt: { toMillis: () => Date.now() } });
    await assert.rejects(claim(f.db, 'u', 'migration', 'disconnect'));
    const stop = await claim(f.db, 'u', 'migration', 'stop');
    await finish(f.db, stop);
    await assert.rejects(claim(f.db, 'u', 'migration', 'disconnect'));
});
test('failed cleanup retains session; stale operation cannot unlock a new operation', async () => {
    const f = fixture(); await connected(f);
    const d = await claim(f.db, 'u', 'migration', 'disconnect'); await finish(f.db, d, false);
    assert.ok(f.lock());
    const run = await claim(f.db, 'u', 'migration', 'run');
    await finish(f.db, d, true);
    assert.equal(f.lock().operationId, run.operationId);
});
test('late status result cannot recreate a deleted or replaced connection', async () => {
    const f = fixture();
    await assert.rejects(markMigrationConnected(f.db, 'u', 'migration', 'old'));
    f.records.set('users/u', { notionMigrationAccessToken: 'new' });
    await assert.rejects(markMigrationConnected(f.db, 'u', 'migration', 'old'));
});

test('HTTP response is sent only after the session transaction finishes', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const source = fs.readFileSync(require.resolve('../lib/index'), 'utf8');
    const code = source.slice(source.indexOf('function withMigrationSession('), source.indexOf('function isTemplateTransfer('));
    const events = [];
    const wrap = vm.runInNewContext(code + '; withMigrationSession;', {
        db: {}, console,
        isTemplateTransfer: () => false,
        migration_session_1: {
            claimMigrationSession: async () => ({ sessionId: 'session' }),
            finishMigrationSession: async () => { await Promise.resolve(); events.push('release'); }
        },
        lifeup_migration_runner_1: { MigrationConflict: Error }
    });
    const response = { status() { return this; }, json() { events.push('response'); } };
    await wrap('check', async (req, res) => { events.push('handler'); return res.status(200).json({ success: true }); })({ body: { userId: 'u' } }, response);
    assert.deepEqual(events, ['handler', 'release', 'response']);
});

test('stop requests prevent disconnect until their own transaction is finished', async () => {
    const f = fixture(); await connected(f);
    const stop = await claim(f.db, 'u', 'migration', 'stop');
    await assert.rejects(claim(f.db, 'u', 'migration', 'disconnect'));
    await finish(f.db, stop);
    const d = await claim(f.db, 'u', 'migration', 'disconnect');
    await finish(f.db, d, true);
    assert.equal(f.lock(), undefined);
});
