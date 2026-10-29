const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'buildAssistantResponse');
const { TEMPLATE_PRODUCTS } = require('../lib/template-catalog');
const context = { TEMPLATE_PRODUCTS };
vm.runInNewContext(ts.transpile(fn.getText(ast)), context);
const root = 'https://app.notion.com/template';
const mobile = 'https://app.notion.com/mobile';
const result = { action: 'create', db: 'reference', title: 'Photo' };

test('Scrapbook without mobile pages links to the template root', () => {
    assert.ok(context.buildAssistantResponse(result, undefined, { root, reference_mobile: '' }).includes('notion://app.notion.com/template'));
});

test('existing mobile destinations take precedence over the template root', () => {
    const response = context.buildAssistantResponse(result, undefined, { root, reference_mobile: mobile });
    assert.ok(response.includes('notion://app.notion.com/mobile'));
    assert.ok(!response.includes('notion://app.notion.com/template'));
});

test('confirmed Scrapbook saves use the same response builder', () => {
    const start = source.indexOf('                converted.response = buildAssistantResponse(');
    assert.notEqual(start, -1);
    const end = source.indexOf(';', start) + 1;
    const converted = { ...result, scrapbookConfirmed: true, response: 'Saved' };
    vm.runInNewContext(source.slice(start, end), {
        converted, pageId: undefined, pageUrls: { root, reference_mobile: '' }, buildAssistantResponse: context.buildAssistantResponse
    });
    assert.ok(converted.response.includes('notion://app.notion.com/template'));
});

test('missing template URLs do not produce a broken link', () => {
    assert.ok(!context.buildAssistantResponse(result).includes('notion://'));
});

test('Second Brain keeps classification and title while linking to the inbox template root', () => {
    const { toNoteCapture } = require('../lib/template-capture');
    const capture = toNoteCapture({ action: 'create', db: 'task', title: '회의 준비' }, {}, '회의 준비');
    const response = context.buildAssistantResponse(capture, undefined,
        { root: 'https://www.notion.so/template-root', task_mobile: mobile }, 'created-page');
    assert.ok(response.includes('📝제목 : 회의 준비'));
    assert.ok(response.includes('📥저장 위치 : ✅ 할일 관리'));
    assert.ok(response.includes("'[ 할일 ] 회의 준비'을 수집함으로 등록했습니다. 세컨드브레인OS는 항상 노트 수집함에 저장합니다."));
    assert.ok(response.includes('https://app.notionable.net/upgrade/lifeup-secondbrain?from=lifeUpSecondBrainOS_kakao'));
    assert.ok(response.includes('https://www.notion.so/template-root'));
    assert.ok(!response.includes('createdpage'));
    assert.ok(!response.includes(mobile));
    assert.ok(response.includes('📢 [시험 운영 안내]'));
});

test('Second Brain editions use their own upgrade path and tracking source', () => {
    for (const [templateId, slug] of [['lifeUpSecondBrainOSLite', 'lifeup-secondbrain-lite'], ['lifeUpSecondBrainOS', 'lifeup-secondbrain']]) {
        const response = context.buildAssistantResponse({ action: 'create', noteCapture: true, title: 'Note', templateId });
        assert.ok(response.includes('https://app.notionable.net/upgrade/' + slug + '?from=' + templateId + '_kakao'));
        assert.ok(!response.includes('/upgrade/lifeup-planner-lite'));
    }
});
