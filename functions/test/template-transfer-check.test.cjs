const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the actual shared preflight worker with in-memory Notion/Firestore adapters.
const compiled = fs.readFileSync(require.resolve('../lib/index.js'), 'utf8');
const start = compiled.indexOf('async function runLifeUpMigrationCheck(');
const end = compiled.indexOf('exports.migrateLifeUp =', start);
assert.ok(start >= 0 && end > start);
function harness({ transferPlan, schema = {}, count = 1, missingLegacy = false }) {
    const records = new Map();
    const queried = [];
    function ref(path) {
        return {
            collection: name => ref(`${path}/${name}`), doc: name => ref(`${path}/${name}`),
            get: async () => ({ data: () => records.get(path) }),
            set: async (value, options) => records.set(path, { ...(options?.merge ? records.get(path) : {}), ...value }),
            update: async value => records.set(path, { ...records.get(path), ...value })
        };
    }
    const db = { collection: name => ref(name), runTransaction: async fn => fn({ get: r => r.get(), set: (r, v, o) => r.set(v, o) }) };
    const context = {
        db, console: { log() {}, error() {} },
        admin: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } },
        lifeUpMigrationDbInfo: {
            note: { v13: true, v15: true, migration: 'all' },
            habit: { v13: false, v15: true, migration: 'all' },
            apps: { v13: true, v15: true, migration: 'none' }
        },
        resolveTransfer: async () => { if (transferPlan instanceof Error) throw transferPlan; return transferPlan; },
        NotionService: {
            getDatabaseIdByDatabaseName: async (_, name, version) => {
                if (missingLegacy && version === '1.3') throw new Error('not found');
                return `${name}-${version}`;
            },
            resolveDataSourceId: async (_, id) => id,
            getDataSourceSchema: async (_, id) => { queried.push(id); return schema[id] || {}; },
            countDataSource: async () => count
        }
    };
    const run = vm.runInNewContext(`${compiled.slice(start, end)}\nrunLifeUpMigrationCheck`, context);
    return { run, records, queried };
}
const plan = { template: 'scrapbook', pairs: { note: { source: 's', target: 't' } }, skipped: ['habit'] };
test('new preflight skips absent sources and still validates the present DB', async () => {
    const h = harness({ transferPlan: plan });
    await h.run('user', 'fake-token', 'check', true);
    const root = 'users/user/integrations/templateTransfer/migrationCheck/check';
    assert.equal(h.records.get(root).success, true);
    assert.equal(h.records.get(root).sourceTemplate, 'scrapbook');
    assert.equal(h.records.get(`${root}/results/habit`).type, 'source-skipped');
    assert.equal(h.records.get(`${root}/results/note`).type, 'migration');
    assert.deepEqual(h.queried, ['s', 't']);
    assert.equal(h.records.has('users/user/integrations/migration'), false);
});
test('new preflight uses the existing blocking schema comparison', async () => {
    const h = harness({ transferPlan: plan, schema: { s: { name: { id: 'title', type: 'title' }, extra: { id: 'extra', type: 'rich_text' } }, t: { name: { id: 'title', type: 'title' } } } });
    await h.run('user', 'fake-token', 'check', true);
    assert.equal(h.records.get('users/user/integrations/templateTransfer/migrationCheck/check').success, false);
});
test('mixed template discovery fails preflight without checking/moving any pages', async () => {
    const h = harness({ transferPlan: new Error('여러 개별 템플릿') });
    await h.run('user', 'fake-token', 'check', true);
    const root = 'users/user/integrations/templateTransfer/migrationCheck/check';
    assert.equal(h.records.get(root).success, false);
    assert.equal(h.records.get(`${root}/results/discovery`).message, '여러 개별 템플릿');
    assert.deepEqual(h.queried, []);
});
test('legacy preflight still treats missing 1.3 source as an error and excludes 1.5-only habit', async () => {
    const h = harness({ missingLegacy: true });
    await h.run('user', 'fake-token', 'check');
    const root = 'users/user/integrations/migration/migrationCheck/check';
    assert.equal(h.records.get(root).success, false);
    assert.equal(h.records.get(`${root}/results/note`).type, 'not-found-old');
    assert.equal(h.records.has(`${root}/results/habit`), false);
    assert.equal(h.records.has('users/user/integrations/templateTransfer'), false);
});
