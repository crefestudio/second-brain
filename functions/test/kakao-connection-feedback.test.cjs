const { test } = require('node:test');
const assert = require('node:assert/strict');
const { kakaoConnectionErrorMessage, KAKAO_CONNECTION_REQUIRED } = require('../lib/kakao-connection-feedback');

test('missing connection explains both template and Kakao setup', () => {
    assert.equal(kakaoConnectionErrorMessage(Error('NOTION_CONNECTION_REQUIRED')), KAKAO_CONNECTION_REQUIRED);
    assert.match(KAKAO_CONNECTION_REQUIRED, /템플릿과 카카오톡/);
});

test('Notion access failures explain reconnecting, with photo-specific feedback', () => {
    for (const code of ['unauthorized', 'restricted_resource', 'object_not_found']) {
        assert.match(kakaoConnectionErrorMessage({ code }), /노션 API 연결 권한/);
        assert.match(kakaoConnectionErrorMessage({ code }, true), /사진을 저장하지 못했습니다/);
    }
    assert.match(kakaoConnectionErrorMessage(Error('Notion API 호출 실패: 403 / forbidden')), /다시 연결해주세요/);
});

test('missing database is distinguished from permission and unrelated failures', () => {
    assert.match(kakaoConnectionErrorMessage(Error('"note" Database를 찾을 수 없습니다.')), /권한과 데이터베이스 이름/);
    for (const error of [{ status: 404 }, { code: 'rate_limited' }, Error('network failure'), Error('NOTION_CONNECTION_CHANGED')]) {
        assert.equal(kakaoConnectionErrorMessage(error), undefined);
    }
});

test('an access failure before AI processing returns a callback and preserves the error', async () => {
    const fs = require('node:fs');
    const ts = require('typescript');
    const vm = require('node:vm');
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'processKakaoAgent');
    const failure = { code: 'restricted_resource' };
    const replies = [];
    const context = { console: { log() {}, warn() {}, error() {} }, KAKAO_CONNECTION_REQUIRED, kakaoConnectionErrorMessage,
        db: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({}) }) }) }) },
        isUsableNotionConnection: () => true, workspaceTemplate: () => 'test', TEMPLATE_PRODUCTS: { test: { kakaoCaptureScope: 'note' } },
        processAssistantEntity: async () => { throw failure; },
        resposeKakaoMessageByCallbackUrl: async text => replies.push(text) };
    vm.runInNewContext(ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
    await assert.rejects(context.processKakaoAgent('user', 'hello', 'callback', 'job'), error => error === failure);
    assert.equal(replies.length, 1);
    assert.match(replies[0], /노션 API 연결 권한/);
});
