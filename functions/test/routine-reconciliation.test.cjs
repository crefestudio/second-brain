const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const service = tree.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'RoutineService');
const compiled = ts.transpileModule(`${service.getText(tree)}; globalThis.Subject = RoutineService;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

function setup() {
    const data = new Map();
    const writes = [];
    const root = 'users/u/integrations/routine/';
    const snapshot = (path, value) => ({ id: path.split('/').at(-1), exists: value !== undefined, data: () => value, ref: ref(path) });
    function ref(path = '', filters = []) {
        return {
            path,
            collection: name => ref(`${path}/${name}`.replace(/^\//, '')),
            doc: name => ref(`${path}/${name}`),
            where: (key, op, value) => ref(path, [...filters, [key, op, value]]),
            orderBy: () => ref(path, filters),
            get: async () => {
                const docs = [...data].filter(([key, value]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/') &&
                    filters.every(([field, op, expected]) => op === '==' ? value[field] === expected : value[field] <= expected))
                    .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => snapshot(key, value));
                return { ...snapshot(path, data.get(path)), docs };
            }
        };
    }
    const batch = () => {
        const pending = [];
        const write = (target, value) => {
            assert.ok(!/^__.*__$/.test(target.path.split('/').at(-1)), 'Firestore reserves __.*__ document IDs');
            pending.push([target.path, value]);
        };
        return { set: write, update: write, commit: async () => {
            for (const [path, value] of pending) {
                writes.push(path);
                const merged = { ...data.get(path), ...value };
                for (const key of Object.keys(merged)) if (merged[key] === 'DELETE') delete merged[key];
                data.set(path, merged);
            }
        } };
    };
    let notion = { total: 1, completed: 1, goalStats: {} };
    const context = vm.createContext({ db: { ...ref(), batch },
        logger: { info() {}, error() {} },
        admin: { firestore: { FieldValue: { serverTimestamp: () => 'now', delete: () => 'DELETE' } } },
        NotionService: { getDailyHabitStats: async () => { if (notion instanceof Error) throw notion; return notion; } }
    });
    vm.runInContext(compiled, context);
    return { subject: context.Subject, writes, put: (path, value) => data.set(root + path, value),
        get: path => data.get(root + path), notion: value => { notion = value; } };
}

test('repair updates statistics and preserves the original reward basis across repeated repairs', async () => {
    const h = setup();
    h.put('dailyStats/2026-09-01', { date: '2026-09-01', total: 1, completed: 0, useRest: true });
    await h.subject.recordDailyHabitStatsUnlocked('u', '2026-09-01', []);
    await h.subject.recordDailyHabitStatsUnlocked('u', '2026-09-01', []);
    assert.equal(h.get('dailyStats/2026-09-01').completed, 1);
    assert.equal(h.get('dailyStats/2026-09-01').rewardBasis.completed, 0);
    assert.equal(h.get('dailyStats/2026-09-01').rewardBasis.useRest, true);
    assert.equal(h.get('dailyStats/2026-09-01').useRest, true);
});

test('repair refreshes summaries without granting or spending rewards; scheduled processing does not backfill imported rewards', async () => {
    const h = setup();
    for (let i = 1; i <= 10; i++) {
        const date = `2026-09-${String(i).padStart(2, '0')}`;
        h.put(`dailyStats/${date}`, { date, total: 1, completed: 1, rewardBasis: { completed: 0, useRest: false } });
    }
    await h.subject.processHabitStatsUnlocked('u', '2026-09-10', false);
    assert.equal(h.get('summary/all').totalCompleted, 10);
    assert.equal(h.get('summary/all').longestStreak, 10);
    await h.subject.processHabitStatsUnlocked('u', '2026-09-10');
    assert.ok(h.writes.every(path => path.includes('/summary/')));
});

test('a normal scheduled day still earns rewards', async () => {
    const h = setup();
    for (let i = 1; i <= 5; i++) {
        const date = `2026-09-0${i}`;
        h.put(`dailyStats/${date}`, { date, total: 1, completed: 1 });
    }
    await h.subject.processHabitStatsUnlocked('u', '2026-09-05');
    assert.equal(h.get('restHistory/reward_2026-09-05_5').amount, 1);
    assert.equal(h.get('badges/first').code, 'first');
});

test('processing a repaired date does not refund an existing rest token', async () => {
    const h = setup();
    h.put('dailyStats/2026-09-01', { date: '2026-09-01', total: 1, completed: 1, useRest: true,
        rewardBasis: { completed: 0, useRest: true } });
    h.put('restHistory/use_2026-09-01', { date: '2026-09-01', type: 'use', amount: -1 });
    await h.subject.processHabitStatsUnlocked('u', '2026-09-01');
    assert.equal(h.get('restHistory/use_2026-09-01').amount, -1);
    assert.equal(h.get('dailyStats/2026-09-01').useRest, true);
});

test('normal scheduled aggregation replaces the temporary reward basis for its own day', async () => {
    const h = setup();
    h.put('dailyStats/2026-09-01', { date: '2026-09-01', total: 1, completed: 1,
        rewardBasis: { completed: 0, useRest: false } });
    await h.subject.recordDailyHabitStatsUnlocked('u', '2026-09-01');
    assert.equal(h.get('dailyStats/2026-09-01').rewardBasis, undefined);
    await h.subject.processHabitStatsUnlocked('u', '2026-09-01');
    assert.equal(h.get('badges/first').code, 'first');
});

test('goal-only differences count as changes and obsolete goal counts are cleared', async () => {
    const h = setup();
    h.put('dailyStats/2026-09-01', { date: '2026-09-01', total: 1, completed: 1 });
    h.put('goalDailyStats/2026-09-01_old', { date: '2026-09-01', goalId: 'old', total: 1, completed: 1 });
    h.notion({ total: 1, completed: 1, goalStats: { next: { total: 1, completed: 1 } } });
    const result = await h.subject.recordDailyHabitStatsUnlocked('u', '2026-09-01', []);
    assert.equal(result.status, 'updated');
    assert.equal(h.get('goalDailyStats/2026-09-01_old').completed, 0);
    assert.equal(h.get('goalDailyStats/2026-09-01_next').completed, 1);
});

test('a Notion failure does not zero out existing statistics', async () => {
    const h = setup();
    h.notion(new Error('Notion unavailable'));
    await assert.rejects(h.subject.recordDailyHabitStatsUnlocked('u', '2026-09-01', []));
    assert.equal(h.writes.length, 0);
});

test('uncategorized goal history produces a summary with a valid Firestore document ID', async () => {
    const h = setup();
    h.put('goalDailyStats/2026-09-01___routine_uncategorized__', {
        date: '2026-09-01', goalId: '__routine_uncategorized__', total: 2, completed: 1
    });
    await h.subject.processHabitStatsUnlocked('u', '2026-09-01', false);
    const summary = h.get('summary/routine_uncategorized');
    assert.equal(summary.totalCompleted, 1);
    assert.equal(summary.completionRate, 50);
    assert.equal(summary.currentStreak, 1);
    assert.equal(h.get('summary/__routine_uncategorized__'), undefined);
});
