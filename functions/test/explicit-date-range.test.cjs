const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { parseExplicitDateRange, toNotionDate } = require('../lib/services/date-service');
const { resolveTaskKinds } = require('../lib/task-classification');

test('numeric ranges with optional 일 resolve independently of the task title', () => {
    for (const text of ['10/21~30 여행', '10/21~30일 여행', '10/21일~30일 여행', '10/21 ~ 30 사파 여행']) {
        const result = parseExplicitDateRange(text, 2026);
        assert.deepEqual(result.data, { date: '2026-10-21', endDate: '2026-10-30' }, text);
        assert.equal(resolveTaskKinds({ dateData: result.data, kinds: '수집함' }), '일정');
    }
    for (const title of ['사파', '달랏', '일본'])
        assert.deepEqual(parseExplicitDateRange(`10/19~21 ${title} 여행`, 2026).data, { date: '2026-10-19', endDate: '2026-10-21' });
});
test('cross-month range requires an explicit end month; invalid dates do not roll over', () => {
    for (const text of ['10/30~3 여행', '10/30~3일 여행', '10월 30일부터 3일까지', '2/30~31 여행', '10/21~32 여행']) {
        assert.ok(parseExplicitDateRange(text, 2026).question, text);
        assert.equal(parseExplicitDateRange(text, 2026).data, undefined);
    }
    assert.deepEqual(parseExplicitDateRange('10/30~11/3 여행', 2026).data, { date: '2026-10-30', endDate: '2026-11-03' });
});
test('Korean ranges and inclusive durations support whitespace and month boundaries', () => {
    for (const text of ['10월 20일부터 21일까지 여행', '10월 20일 부터 21일 까지 여행'])
        assert.deepEqual(parseExplicitDateRange(text, 2026).data, { date: '2026-10-20', endDate: '2026-10-21' });
    for (const text of ['10월 20일 부터 3일간 여행', '10월 20일부터 3일간', '10/20부터 3일간 여행'])
        assert.deepEqual(parseExplicitDateRange(text, 2026).data, { date: '2026-10-20', endDate: '2026-10-22' });
    assert.deepEqual(parseExplicitDateRange('10월 30일부터 5일간 여행', 2026).data, { date: '2026-10-30', endDate: '2026-11-03' });
    assert.ok(parseExplicitDateRange('10월 20일부터 0일간', 2026).question);
});
test('explicit year and leap dates are validated; time expressions keep the existing path', () => {
    assert.deepEqual(parseExplicitDateRange('2026년 12월 30일부터 2027년 1월 3일까지 여행').data,
        { date: '2026-12-30', endDate: '2027-01-03' });
    assert.ok(parseExplicitDateRange('2/29~3/1', 2026).question);
    assert.deepEqual(toNotionDate(parseExplicitDateRange('2/29~3/1', 2028).data), { start: '2028-02-29', end: '2028-03-01' });
    assert.equal(parseExplicitDateRange('10/20~21 오후 3시 여행', 2026), null);
    assert.equal(parseExplicitDateRange('10월 여행', 2026), null);
});
test('actual processing bypasses AI for supported ranges and asks for ambiguous ranges', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const start = source.indexOf('export async function processDateExpression(');
    const end = source.indexOf('function getPreviousDateData(', start);
    const context = { exports: {}, parseExplicitDateRange: text => parseExplicitDateRange(text, 2026),
        hasMonthWithoutDay: () => { throw Error('explicit range must resolve first'); },
        requestDateExpressionFromAI: () => { throw Error('must not call AI'); } };
    vm.createContext(context);
    vm.runInContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), context);
    const resolved = await context.exports.processDateExpression('10/19~21 사파 여행');
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.data.endDate, '2026-10-21');
    const rejected = await context.exports.processDateExpression('10/30~3 사파 여행');
    assert.equal(rejected.status, 'dateAsk');
    assert.equal(rejected.data, undefined);
});
