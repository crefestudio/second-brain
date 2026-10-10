const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');

test('a Notion-unconnected workspace receives an empty template response, not a 400 error', async () => {
    const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const handler = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'getLifeupTemplateInfo'));
    const context = { exports: {}, onRequest: fn => fn, withCors: fn => fn,
        NotionService: { getLifeupTemplateInfo: async () => { throw Error('NOTION_NOT_CONNECTED'); } }, console };
    vm.runInNewContext(ts.transpileModule(handler.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await context.exports.getLifeupTemplateInfo({ body: { userId: 'workspace' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(res.body)), { success: true, data: null });
});
