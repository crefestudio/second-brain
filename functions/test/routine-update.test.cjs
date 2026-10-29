const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const cls = tree.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'NotionService');
const method = cls.members.find(n => n.name?.getText(tree) === 'updateNotionHabit');
const compiled = ts.transpileModule(`class Subject { ${method.getText(tree)} } globalThis.Subject = Subject;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
}).outputText;

test('existing habits update the text start-time property, including early morning', async () => {
    for (const time of ['01:06', '12:00', '19:00']) {
        const requests = [];
        const chain = { collection: () => chain, doc: () => chain,
            get: async () => ({ exists: true, data: () => ({ notionAccessToken: 'test' }) }) };
        const context = vm.createContext({ db: chain, logger: { info() {}, error() {} },
            Client: function () { return {
                dataSources: { query: async () => ({ results: [{ id: 'existing-page' }] }) },
                pages: { update: async request => {
                    // Model the production rich_text schema: a date payload must fail.
                    assert.equal(request.properties['시작 시간'].date, undefined);
                    assert.equal(request.properties['시작 시간'].rich_text[0].text.content, time);
                    requests.push(request);
                } }
            }; }
        });
        vm.runInContext(compiled, context);
        context.Subject.resolveDatabaseId = async () => 'database';
        context.Subject.resolveDataSourceId = async () => 'source';
        const result = await context.Subject.updateNotionHabit('user', {
            id: 'habit', name: '스트레칭', days: ['월', '수'], time, duration: 10, notify: true, status: '진행 중'
        });
        assert.equal(result.updated, true);
        assert.equal(result.pageId, 'existing-page');
        assert.equal(requests.length, 1);
        assert.deepEqual(Array.from(requests[0].properties['반복 주기'].multi_select, d => d.name), ['월', '수']);
    }
});
