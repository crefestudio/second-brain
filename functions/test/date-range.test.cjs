const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveDateData, toNotionDate } = require('../lib/services/date-service');

test('range inherits start month and year; Notion receives both inclusive dates', () => {
    const data = resolveDateData('date:2026-10-16..date:18');
    assert.deepEqual(data, { date: '2026-10-16', endDate: '2026-10-18' });
    assert.deepEqual(toNotionDate(data), { start: '2026-10-16', end: '2026-10-18' });
});
test('month and explicit year boundaries', () => {
    assert.equal(resolveDateData('date:2026-10-30..date:11-02').endDate, '2026-11-02');
    assert.equal(resolveDateData('date:2026-12-30..date:2027-01-02').endDate, '2027-01-02');
});
test('timed range and timezone', () => {
    const data = resolveDateData('date:2026-10-16+09:00..date:18+18:00');
    assert.deepEqual(toNotionDate(data), { start: '2026-10-16T09:00:00', end: '2026-10-18T18:00:00', time_zone: 'Asia/Seoul' });
});
test('invalid ranges are rejected rather than silently saved', () => {
    for (const expr of ['date:2026-10-18..date:16', 'date:2026-02-30..date:2026-03-03', 'date:2026-10-16..date:32', 'date:2026-10-16+09:00..date:18', 'date:2026-10-16..bad']) {
        assert.equal(resolveDateData(expr), null, expr);
    }
});
test('single dates retain behavior and relative correction moves whole range', () => {
    assert.deepEqual(resolveDateData('date:2026-10-16'), { date: '2026-10-16' });
    assert.deepEqual(resolveDateData('prev+1d', { date:'2026-10-16', endDate:'2026-10-18' }), { date:'2026-10-17', endDate:'2026-10-19' });
    assert.deepEqual(resolveDateData('date:2026-10-20..date:22', { date:'2026-10-16', time:'09:00', endDate:'2026-10-18', endTime:'18:00' }), { date:'2026-10-20', endDate:'2026-10-22' });
});

test('response displays both endpoints and detects an end-only correction', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const ts = require('typescript');
    const service = require('../lib/services/date-service');
    const source = fs.readFileSync(require('node:path').join(__dirname, '../src/index.ts'), 'utf8');
    const code = source.slice(source.indexOf('function buildAssistantResponse('), source.indexOf('async function resposeKakaoMessageByCallbackUrl('));
    const context = vm.createContext({ ...service });
    vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2020 }), context);
    const result = { action:'correct', db:'task', title:'제주', type:'일정', dateData:{date:'2026-10-16',endDate:'2026-10-19'} };
    const text = context.buildAssistantResponse(result, {...result, dateData:{date:'2026-10-16',endDate:'2026-10-18'}});
    assert.match(text, /10월 16일.*~.*10월 19일/);
    assert.match(text, /날짜.*수정/);
});
