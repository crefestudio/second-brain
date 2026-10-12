const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const start = source.indexOf('function sameNotionId(');
const end = source.indexOf('// #webhook', start);
const noteProperties = { '키워드': { type: 'multi_select', multi_select: [] } };
function fixture(page, existing = { keywords: ['retained'] }, config = {}) {
    let record = existing;
    config = { accessToken: 'token', ...config };
    const ref = { collection: () => ref, doc: () => ref, get: async () => ({ data: () => config }) };
    const context = {
        assertNotionConnection: async () => {},
        isUsableNotionConnection: user => user?.notionAccessToken === 'token',
        db: { collection: () => ref, runTransaction: async fn => { let reads = 0; return fn({
            get: async () => ++reads === 1 ? { data: () => ({ notionAccessToken: 'token' }) } : ({ exists: !!record, data: () => record }),
            set: (_ref, value) => { record = { ...record, ...value }; }
        }); } },
        NotionService: { getNotionPage: async () => {
            if (page instanceof Error) throw page;
            return page;
        } },
        Client: class {
            pages = { retrieve: async () => { if (page instanceof Error) throw page; return page; } };
            databases = { retrieve: async () => { throw new Error('Parent database must not be queried'); } }; },
        admin: { firestore: { FieldValue: { serverTimestamp: () => 1 } } }
    };
    vm.createContext(context);
    vm.runInContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2020 }), context);
    return { run: () => context.reconcileSecondBrainPage('user', 'token', { id: 'page' }), record: () => record };
}
test('deleted note is hidden without deleting keywords; restoring reactivates', async () => {
    const deleted = fixture({ id: 'page', properties: noteProperties, in_trash: true });
    assert.equal(await deleted.run(), false);
    assert.equal(deleted.record().inactiveReason, 'deleted');
    assert.deepEqual(deleted.record().keywords, ['retained']);
    const restored = fixture({ id: 'page', properties: noteProperties }, deleted.record());
    assert.equal(await restored.run(), true);
    assert.equal(restored.record().active, true);
});
test('contact without keyword property is not collected; existing contamination is hidden', async () => {
    const page = { id: 'page', properties: {}, parent: { database_id: 'contacts' } };
    const fresh = fixture(page, null);
    assert.equal(await fresh.run(), false);
    assert.equal(fresh.record(), null);
    const moved = fixture(page);
    assert.equal(await moved.run(), false);
    assert.equal(moved.record().inactiveReason, 'missing-keyword-property');
    assert.deepEqual(moved.record().keywords, ['retained']);
});
test('moved notes retain keywords despite stale database cache and are reactivated', async () => {
    const sample = fixture({ id: 'page', properties: noteProperties, parent: { data_source_id: 'v15-note-source' } },
        { active: false, inactiveReason: 'outside-note-database', keywords: ['retained'] }, { noteDatabaseId: 'v13-note-db' });
    assert.equal(await sample.run(), true);
    assert.equal(sample.record().active, true);
    assert.equal(sample.record().inactiveReason, null);
    assert.deepEqual(sample.record().keywords, ['retained']);
});
test('empty keyword field qualifies without any parent or database configuration', async () => {
    assert.equal(await fixture({ id: 'page', properties: noteProperties }, null).run(), true);
    assert.equal(await fixture({ id: 'page', properties: { '키워드': { type: 'rich_text' } } }, null).run(), false);
});
test('404, timeout and incomplete page responses preserve visibility', async () => {
    for (const error of ['404', 'timeout']) {
        const sample = fixture(new Error(error), { active: true });
        await assert.rejects(sample.run());
        assert.equal(sample.record().active, true);
    }
    const sample = fixture({ id: 'page' }, { active: true });
    await assert.rejects(sample.run());
    assert.equal(sample.record().active, true);
});
test('older in-flight observations cannot revive a newer tombstone', async () => {
    const sample = fixture({ id: 'page', properties: noteProperties },
        { active: false, visibilityObservedAt: Date.now() + 100000 });
    assert.equal(await sample.run(), false);
    assert.equal(sample.record().active, false);
});

test('cache reset fences in-flight analysis while permitting a new generation', async () => {
    const begin = source.indexOf('async function saveSecondBrainKeywords(');
    const finish = source.indexOf('export const resetSecondBrainGraphCache', begin);
    for (const [config, generation, shouldWrite] of [
        [{ cacheGeneration: 2 }, 1, false],
        [{ cacheGeneration: 2, cacheResetInProgress: true }, 2, false],
        [{ cacheGeneration: 2 }, 2, true]
    ]) {
        let written = false;
        const ref = { collection: () => ref, doc: () => ref };
        const context = { db: { collection: () => ref, runTransaction: async fn => fn({
            get: async () => ({ data: () => config }), set: () => { written = true; }
        }) } };
        vm.createContext(context);
        vm.runInContext(ts.transpile(source.slice(begin, finish), { target: ts.ScriptTarget.ES2020 }), context);
        await context.saveSecondBrainKeywords('user', 'page', generation, { keywords: ['test'] });
        assert.equal(written, shouldWrite);
    }
});
