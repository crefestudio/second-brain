const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { habitDayRange } = require('../lib/routine-utils');

// Load the actual method without initializing Firebase, credentials or other APIs.
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const notionClass = tree.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'NotionService');
const method = notionClass.members.find(node => node.name?.getText(tree) === 'createNotionHabitLog');
const compiled = ts.transpileModule(`class Subject { ${method.getText(tree)} } globalThis.Subject = Subject;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

function setup({ syncError, existingLog, receipt: initialReceipt } = {}) {
    let receipt = initialReceipt;
    const calls = { sync: 0, create: [], query: 0 };
    const receiptRef = { get: async () => ({ data: () => receipt }), set: async value => { receipt = value; } };
    const chain = { collection: () => chain, doc: () => chain, get: async () => ({ exists: true, data: () => ({ notionAccessToken: 'test-only' }) }) };
    chain.collection = name => name === 'dailyLogReceipts' ? { doc: () => receiptRef } : chain;
    const notion = {
        dataSources: { query: async request => {
            calls.query++;
            if (request.data_source_id === 'habit-source') return { results: [] };
            return { results: existingLog ? [{ id: existingLog }] : [] };
        } },
        pages: {
            create: async request => { calls.create.push(request); return { id: 'new-log' }; },
            retrieve: async ({ page_id }) => ({ id: page_id, archived: false, in_trash: false })
        }
    };
    const context = vm.createContext({
        db: chain, Client: function () { return notion; }, habitDayRange,
        logger: { info() {}, error() {} },
        admin: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } },
        RoutineService: { syncHabit: async () => {
            calls.sync++;
            if (syncError) throw new Error(syncError);
            return { pageId: 'repaired-parent' };
        } }
    });
    vm.runInContext(compiled, context);
    const subject = context.Subject;
    subject.resolveDatabaseId = async (_token, _user, name) => name === 'habit log' ? 'log-source' : 'habit-source';
    subject.resolveDataSourceId = async (_token, database) => database;
    const run = () => subject.createNotionHabitLog('user', { id: 'habit', name: 'Read', time: '23:59', days: ['월'] }, '2026-09-21');
    return { run, calls, receipt: () => receipt };
}

test('missing Notion parent is synced before creating its daily record', async () => {
    const harness = setup();
    assert.equal((await harness.run()).created, true);
    assert.equal(harness.calls.sync, 1);
    assert.equal(harness.calls.create[0].properties.습관.relation[0].id, 'repaired-parent');
    assert.equal(harness.receipt().pageId, 'new-log');
});

test('a repeat run uses the persisted page ID even if queries still return no record', async () => {
    const harness = setup();
    await harness.run();
    const queries = harness.calls.query;
    assert.equal((await harness.run()).created, false);
    assert.equal(harness.calls.create.length, 1);
    assert.equal(harness.calls.query, queries);
});

test('sync failure does not create an unlinked daily record or save a receipt', async () => {
    const harness = setup({ syncError: 'HABIT_SYNC_IN_PROGRESS' });
    await assert.rejects(harness.run(), /HABIT_SYNC_IN_PROGRESS/);
    assert.equal(harness.calls.create.length, 0);
    assert.equal(harness.receipt(), undefined);
});

test('existing Notion record is reused and backfills its receipt', async () => {
    const harness = setup({ existingLog: 'existing-log' });
    assert.equal((await harness.run()).created, false);
    assert.equal(harness.calls.create.length, 0);
    assert.equal(harness.receipt().pageId, 'existing-log');
});

test('a receipt from a previously connected database does not hide missing records', async () => {
    const harness = setup({ receipt: { dataSourceId: 'old-source', pageId: 'old-page' } });
    assert.equal((await harness.run()).created, true);
    assert.equal(harness.receipt().dataSourceId, 'log-source');
});

const routineClass = tree.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'RoutineService');
const statsMethod = routineClass.members.find(node => node.name?.getText(tree) === 'processHabitStatsUnlocked');
const statsCode = ts.transpileModule(`class Stats { ${statsMethod.getText(tree)} } globalThis.Stats = Stats;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

function statsHarness(data) {
    const writes = [];
    function ref(path = '', filters = []) {
        return {
            path,
            collection: name => ref(`${path}/${name}`),
            doc: id => ref(`${path}/${id}`),
            where: (field, op, value) => ref(path, [...filters, { field, op, value }]),
            orderBy: () => ref(path, filters),
            get: async () => ({ docs: (data[path.split('/').pop()] || [])
                .filter(row => filters.every(f => f.op === '<=' ? row[f.field] <= f.value : row[f.field] === f.value))
                .map(row => ({ id: row.id, data: () => ({ ...row }) })) })
        };
    }
    const context = vm.createContext({
        db: { ...ref(), batch: () => ({
            set: (ref, value) => writes.push({ path: ref.path, value }),
            update: (ref, value) => writes.push({ path: ref.path, value }),
            commit: async () => {}
        }) },
        logger: { info() {} }, admin: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } }
    });
    vm.runInContext(statsCode, context);
    context.Stats.BADGE_THRESHOLDS = [];
    context.Stats.TROPHY_THRESHOLDS = [];
    return { run: () => context.Stats.processHabitStatsUnlocked('user', '2026-09-21'), writes };
}

test('unfinished future-day stats do not reset yesterday streak or dilute completion', async () => {
    const harness = statsHarness({ dailyStats: [
        { id: 'yesterday', date: '2026-09-21', total: 6, completed: 6 },
        { id: 'today', date: '2026-09-22', total: 6, completed: 0 }
    ] });
    await harness.run();
    const summary = harness.writes.find(w => w.path.endsWith('/summary/all')).value;
    assert.equal(summary.currentStreak, 1);
    assert.equal(summary.completionRate, 100);
});

test('a late completion returns a consumed rest token during reaggregation', async () => {
    const harness = statsHarness({
        dailyStats: [{ id: '2026-09-21', date: '2026-09-21', total: 6, completed: 1, useRest: true }],
        restHistory: [{ id: 'use_2026-09-21', amount: -1 }]
    });
    await harness.run();
    assert.equal(harness.writes.find(w => w.path.endsWith('/restHistory/use_2026-09-21')).value.amount, 0);
    assert.equal(harness.writes.find(w => w.path.endsWith('/dailyStats/2026-09-21')).value.useRest, false);
});

test('a day without scheduled records does not spend a rest token', async () => {
    const harness = statsHarness({
        dailyStats: [{ id: '2026-09-21', date: '2026-09-21', total: 0, completed: 0 }],
        restHistory: [{ id: 'reward', amount: 1 }]
    });
    await harness.run();
    assert.equal(harness.writes.some(w => w.path.endsWith('/restHistory/use_2026-09-21')), false);
});
