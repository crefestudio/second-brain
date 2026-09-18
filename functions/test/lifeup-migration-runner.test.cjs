const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const admin = require('firebase-admin');

let moveCalls = [];
let retrieveCalls = [];
let onMove;
let currentParent = 'target';
const originalLoad = Module._load;
Module._load = function (name, ...args) {
    if (name === '@notionhq/client') return {
        LogLevel: { INFO: 'info', WARN: 'warn', ERROR: 'error' },
        Client: class {
            pages = {
                move: async ({ page_id }) => { moveCalls.push(page_id); if (onMove) await onMove(page_id); },
                retrieve: async ({ page_id }) => {
                    retrieveCalls.push(page_id);
                    return { parent: { type: 'data_source_id', data_source_id: currentParent } };
                }
            };
        }
    };
    return originalLoad.call(this, name, ...args);
};
const { executeMigration, MigrationConflict } = require('../lib/lifeup-migration-runner');
Module._load = originalLoad;

const root = 'users/user/integrations/migration';
const runPath = `${root}/migration/run`;
const timestamp = ms => admin.firestore.Timestamp.fromMillis(ms);
const stamp = admin.firestore.FieldValue.serverTimestamp().constructor;
const deleted = admin.firestore.FieldValue.delete().constructor;

function memoryDb(seed) {
    const records = new Map(Object.entries(seed));
    function apply(path, value, merge = true) {
        const next = merge ? { ...records.get(path) } : {};
        for (const [key, item] of Object.entries(value)) {
            if (item instanceof deleted) delete next[key];
            else next[key] = item instanceof stamp ? timestamp(Date.now()) : item;
        }
        records.set(path, next);
    }
    function ref(path, filters = [], sort, max) {
        return {
            path, id: path.split('/').pop(),
            collection: name => ref(`${path}/${name}`), doc: id => ref(`${path}/${id}`),
            orderBy: (field, direction) => ref(path, filters, [field, direction], max),
            limit: count => ref(path, filters, sort, count),
            async get() {
                if (path.split('/').length % 2 === 0) return { exists: records.has(path), data: () => records.get(path) };
                let docs = [...records.entries()].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
                    .map(([key, data]) => ({ id: key.split('/').pop(), data: () => data }));
                if (sort) docs.sort((a, b) => (a.data()[sort[0]] - b.data()[sort[0]]) * (sort[1] === 'desc' ? -1 : 1));
                if (max) docs = docs.slice(0, max);
                return { docs };
            }
        };
    }
    let queue = Promise.resolve();
    return {
        records, collection: name => ref(name),
        runTransaction(operation) {
            const pending = queue.then(async () => {
                const writes = [];
                const result = await operation({
                    get: reference => reference.get(),
                    update: (reference, value) => writes.push(() => apply(reference.path, value)),
                    set: (reference, value, options) => writes.push(() => apply(reference.path, value, !!options?.merge))
                });
                writes.forEach(write => write());
                return result;
            });
            queue = pending.catch(() => {});
            return pending;
        }
    };
}
function fixture(pages, extra = {}) {
    moveCalls = []; retrieveCalls = []; onMove = undefined; currentParent = 'target';
    return memoryDb({
        [root]: { migrationRunId: 'run' },
        [runPath]: { status: 'migrating', createdAt: timestamp(Date.now() - 7200000), totalCount: pages.length, ...extra },
        ...Object.fromEntries(pages.map(([id, status]) => [`${runPath}/pages/${id}`, { pageId: id, pageName: id, dbName: 'task', status }]))
    });
}
const deps = (pages = []) => ({
    entries: [['task', {}]], resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
    pages: async () => pages.map(id => ({ id, title: id }))
});

test('resume preserves completed pages and reconciles a move whose result was lost', async () => {
    const db = fixture([['done', 'complete'], ['uncertain', 'migrating'], ['pending', 'pending']]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(['pending']));
    assert.deepEqual(moveCalls, ['pending']);
    assert.deepEqual(retrieveCalls, ['uncertain']);
    assert.equal(db.records.get(runPath).completedCount, 3);
    assert.equal(db.records.get(runPath).totalCount, 3);
    assert.equal(db.records.get(runPath).success, true);
});

test('an active lease rejects a second worker', async () => {
    const db = fixture([], { workerId: 'active', leaseExpiresAt: timestamp(Date.now() + 300000) });
    await assert.rejects(executeMigration(db, 'user', 'token', 'run', 'resume', deps()), MigrationConflict);
    assert.deepEqual(moveCalls, []);
});

test('stop saves the in-flight result and resume processes only the remaining page', async () => {
    const db = fixture([['first', 'pending'], ['second', 'pending']]);
    onMove = async () => { await executeMigration(db, 'user', 'token', 'run', 'stop', deps()); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first']);
    assert.equal(db.records.get(runPath).status, 'stopped');
    assert.equal(db.records.get(runPath).completedCount, 1);
    onMove = undefined;
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first', 'second']);
    assert.equal(db.records.get(runPath).completedCount, 2);
});

test('a displaced worker cannot write a result or start the next move', async () => {
    const db = fixture([['first', 'pending'], ['second', 'pending']]);
    onMove = async () => { db.records.set(runPath, { ...db.records.get(runPath), workerId: 'successor' }); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first']);
    assert.equal(db.records.get(`${runPath}/pages/first`).status, 'migrating');
    assert.equal(db.records.get(runPath).workerId, 'successor');
});

test('legacy invocation cannot be taken over before its maximum lifetime', async () => {
    const db = fixture([], { createdAt: timestamp(Date.now() - 600000) });
    await assert.rejects(executeMigration(db, 'user', 'token', 'run', 'resume', deps()), MigrationConflict);
});

test('failed pages remain unfinished and can be retried without recounting successes', async () => {
    const db = fixture([['done', 'complete'], ['retry', 'pending']]);
    onMove = async () => { throw new Error('temporary failure'); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.equal(db.records.get(runPath).success, false);
    assert.equal(db.records.get(runPath).completedCount, 1);
    onMove = undefined; currentParent = 'source';
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.equal(db.records.get(runPath).completedCount, 2);
    assert.equal(db.records.get(runPath).success, true);
});

test('expired lease permits recovery but a page moved elsewhere is not moved again', async () => {
    const db = fixture([['uncertain', 'migrating']], {
        workerId: 'expired', leaseExpiresAt: timestamp(Date.now() - 1)
    });
    currentParent = 'unrelated';
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, []);
    assert.equal(db.records.get(runPath).success, false);
    assert.equal(db.records.get(runPath).completedCount, 0);
});

test('large manifests are persisted in chunks before any move starts', async () => {
    const db = fixture([]);
    const ids = Array.from({ length: 401 }, (_, index) => `page-${index}`);
    onMove = async () => {
        assert.equal(db.records.get(runPath).totalCount, 401);
        assert.ok(db.records.has(`${runPath}/pages/page-400`));
        await executeMigration(db, 'user', 'token', 'run', 'stop', deps());
    };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(ids));
    assert.equal(moveCalls.length, 1);
    assert.equal(db.records.get(runPath).status, 'stopped');
    assert.equal(db.records.get(runPath).totalCount, 401);
});

test('all databases are counted before the first move, including saved successes', async () => {
    const db = fixture([['done', 'complete']]);
    const queried = [];
    const dependencies = {
        entries: [['task', {}], ['folder', {}]],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => {
            queried.push(source);
            return [{ id: source, title: source }];
        }
    };
    onMove = async () => {
        assert.equal(queried.length, 2);
        assert.equal(db.records.get(runPath).totalCount, 3);
        assert.equal(db.records.get(runPath).totalCountReady, true);
    };
    await executeMigration(db, 'user', 'token', 'run', 'resume', dependencies);
    assert.equal(db.records.get(runPath).completedCount, 3);
    assert.equal(moveCalls.length, 2);
});

test('checkbox defaults are excluded on resume, while matching titles and move defaults migrate', async () => {
    const db = fixture([['default', 'pending']]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [
            ['task', { defaultMigration: 'none', defaultProperty: '기본 휴일' }],
            ['folder', { defaultMigration: 'move', defaultProperty: '기본 폴더' }]
        ],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => source.startsWith('task') ? [
            { id: 'default', title: '설날', properties: { '기본 휴일': { type: 'checkbox', checkbox: true } } },
            { id: 'regular', title: '기본 휴일', properties: { '기본 휴일': { type: 'checkbox', checkbox: false } } }
        ] : [{ id: 'folder', title: '기본 폴더', properties: { '기본 폴더': { type: 'checkbox', checkbox: true } } }]
    });
    assert.deepEqual(moveCalls, ['regular', 'folder']);
    assert.equal(db.records.get(`${runPath}/pages/default`).status, 'skipped');
    assert.equal(db.records.get(runPath).totalCount, 2);
    assert.equal(db.records.get(runPath).completedCount, 2);
});

test('failed discovery never publishes a partial total or starts moving pages', async () => {
    const db = fixture([]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['task', {}], ['folder', {}]],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => {
            if (source.startsWith('folder')) throw new Error('query failed');
            return [{ id: 'pending', title: 'pending' }];
        }
    });
    assert.deepEqual(moveCalls, []);
    assert.equal(db.records.get(runPath).totalCountReady, false);
    assert.equal(db.records.get(runPath).status, 'error');
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(['pending']));
    assert.equal(db.records.get(runPath).totalCount, 1);
    assert.equal(db.records.get(runPath).completedCount, 1);
});
