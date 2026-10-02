const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { hasMonthWithoutDay } = require('../lib/services/date-service');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/index.ts'), 'utf8');

test('month-only plans remain undated; specific dates and ranges are unchanged', () => {
    for (const text of ['10월에 군산가기', '2026년 10월에 군산가기', '다음 달 여행하기', '이번달 책 읽기', '10월 말에 군산가기']) assert.equal(hasMonthWithoutDay(text), true, text);
    for (const text of ['10월 16일 군산가기', '10월 16일에서 18일 제주', '10월 첫째 주 월요일 군산가기', '2026-10-16 군산가기', '10월 계획: 내일 예약하기']) assert.equal(hasMonthWithoutDay(text), false, text);
});

test('month-only input skips date AI even after a previous date question', async () => {
    const context = vm.createContext({ exports:{}, hasMonthWithoutDay, requestDateExpressionFromAI: () => { throw Error('must not call date AI'); } });
    const code = source.slice(source.indexOf('export async function processDateExpression('), source.indexOf('function getPreviousDateData('));
    vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS }), context);
    const result = await context.exports.processDateExpression('10월에 군산가기', {result:{action:'dateAsk'}});
    assert.equal(result.status, 'none');
    assert.equal(result.precision, 'month');
    assert.equal(result.data, undefined);
});

test('classification cannot invent a date or remove the month from a new task', async () => {
    const context = vm.createContext({
        console:{log(){}}, KakaoAgentPrompt:'', getTagCache:async()=>[], safeParseAssistantJson:JSON.parse,
        clientAI:{chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify({action:'create',db:'task',type:'갈 것',title:'군산가기',kinds:'일정',dateData:{date:'2026-10-01'},dateExpr:'date:10-01',data:{date:'2026-10-01'}})}}]})}}}
    });
    const start=source.indexOf('async function requestKakaoAssistantActionFromAI(');
    const end=source.indexOf('\n}',start)+2;
    vm.runInContext(ts.transpile(source.slice(start,end), {target:ts.ScriptTarget.ES2020}),context);
    const result=await context.requestKakaoAssistantActionFromAI('user','10월에 군산가기','',undefined,{status:'none',precision:'month'});
    assert.equal(result.db,'task');
    assert.equal(result.title,'10월에 군산가기');
    assert.equal(result.kinds,'수집함');
    assert.equal(result.dateData,undefined);
    assert.equal(result.dateExpr,undefined);
    assert.equal(result.data,undefined);
});
