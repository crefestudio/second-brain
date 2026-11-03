const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const service = require('../lib/services/date-service');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const monday = new Date(2026, 10, 2, 19, 2);

test('bare weekday uses upcoming date and preserves ambiguous time', () => {
    assert.deepEqual(service.parseUpcomingWeekday('금요일 11시 병원 예약', monday), {
        data: { date: '2026-11-06', time: '11:00' }, question: '11시가 오전인가요, 오후인가요?'
    });
    assert.deepEqual(service.parseUpcomingWeekday('금요일 오전 11시', monday).data,
        { date: '2026-11-06', time: '11:00' });
    assert.equal(service.parseUpcomingWeekday('금요일', new Date(2026, 10, 7)).data.date, '2026-11-13');
    assert.equal(service.parseUpcomingWeekday('금요일 오후 12시 반', monday).data.time, '12:30');
    for (const text of ['이번주 금요일 11시', '금요일 11시부터 12시까지', '금요일 오전 25시', '금요일 11시 내일로 변경'])
        assert.equal(service.parseUpcomingWeekday(text, monday), null, text);
});

test('weekday AI aliases resolve rather than losing candidate data', () => {
    for (const expr of ['fri+11:00', 'friday+11:00', 'next:fri+11:00'])
        assert.deepEqual(service.resolveDateData(expr), service.resolveDateData('next:friday+11:00'));
    assert.equal(service.resolveDateData('unknown+11:00'), null);
});

test('Friday request followed by 오전/오후 completes without AI and keeps Friday', async () => {
    const context = vm.createContext({ exports: {}, ...service,
        parseUpcomingWeekday: text => service.parseUpcomingWeekday(text, monday),
        requestDateExpressionFromAI: () => { throw Error('must not call date AI'); } });
    const start = source.indexOf('export async function processDateExpression(');
    const end = source.indexOf('// function createDateFromData', start);
    vm.runInContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), context);
    const first = await context.exports.processDateExpression('금요일 11시 병원 예약');
    assert.equal(first.status, 'dateAsk');
    for (const [answer, time] of [['오전', '11:00'], ['오후', '23:00']]) {
        const result = await context.exports.processDateExpression(answer,
            { userMessage: '금요일 11시 병원 예약', result: { action: 'dateAsk' }, dateData: first.data });
        assert.equal(result.status, 'resolved');
        assert.equal(result.data.date, '2026-11-06');
        assert.equal(result.data.time, time);
    }
});

test('action AI receives original appointment and resolved date after clarification', async () => {
    let prompt;
    const context = vm.createContext({ console: { log() {} }, KakaoAgentPrompt: '', getTagCache: async () => [], safeParseAssistantJson: JSON.parse,
        clientAI: { chat: { completions: { create: async input => {
            prompt = JSON.stringify(input.messages);
            return { choices: [{ message: { content: JSON.stringify({ action: 'create', db: 'task', title: '병원 예약' }) } }] };
        } } } } });
    const start = source.indexOf('async function requestKakaoAssistantActionFromAI(');
    vm.runInContext(ts.transpile(source.slice(start, source.indexOf('\n}', start) + 2), { target: ts.ScriptTarget.ES2020 }), context);
    await context.requestKakaoAssistantActionFromAI('user', '오전', '',
        { userMessage: '금요일 11시 병원 예약', result: { action: 'dateAsk' } },
        { status: 'resolved', data: { date: '2026-11-06', time: '11:00' } });
    assert.match(prompt, /병원 예약/);
    assert.match(prompt, /2026-11-06/);
    assert.match(prompt, /현재 입력은 이전 요청에 대한 추가 답변/);
});
