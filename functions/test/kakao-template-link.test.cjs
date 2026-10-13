const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'buildAssistantResponse');
const context = {};
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
        converted, pageUrls: { root, reference_mobile: '' }, buildAssistantResponse: context.buildAssistantResponse
    });
    assert.ok(converted.response.includes('notion://app.notion.com/template'));
});

test('missing template URLs do not produce a broken link', () => {
    assert.ok(!context.buildAssistantResponse(result).includes('notion://'));
});
