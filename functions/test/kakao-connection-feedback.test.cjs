const { test } = require('node:test');
const assert = require('node:assert/strict');
const { kakaoConnectionErrorMessage, KAKAO_CONNECTION_REQUIRED } = require('../lib/kakao-connection-feedback');

test('missing connection explains both template and Kakao setup', () => {
    assert.equal(kakaoConnectionErrorMessage(Error('NOTION_CONNECTION_REQUIRED')), KAKAO_CONNECTION_REQUIRED);
    assert.match(KAKAO_CONNECTION_REQUIRED, /템플릿과 카카오톡/);
});

test('trashed database reports that nothing was saved and asks for restoration', () => {
    const text = kakaoConnectionErrorMessage(Error('"task" Database를 찾을 수 없습니다. 검색된 DB가 모두 휴지통 또는 보관 상태입니다.'));
    assert.match(text, /저장하지 못했습니다/);
    assert.match(text, /복원/);
});

test('create and correct acknowledge success only after the write succeeds', async () => {
    const fs = require('node:fs');
    const ts = require('typescript');
    const vm = require('node:vm');
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const start = source.indexOf('        console.log("[TIME] sendKakaoCallback START");');
    const end = source.indexOf('    } catch (e) {', start);
    const code = ts.transpile('(async () => {' + source.slice(start, end) + '})()', { target: ts.ScriptTarget.ES2020 });
    for (const action of ['create', 'correct']) {
        for (const fails of [false, true]) {
            const calls = [];
            const context = { console: { log() {} }, enrichedResult: { action, response: 'saved' },
                userId: 'u', entity: {}, guard: async () => {}, callbackUrl: 'callback',
                processAfterResponse: async () => { calls.push('write'); if (fails) throw Error('write failed'); },
                reply: async () => calls.push('success'), logTime() {}, totalStart: 0, t: 0 };
            if (fails) await assert.rejects(vm.runInNewContext(code, context), /write failed/);
            else await vm.runInNewContext(code, context);
            assert.deepEqual(calls, fails ? ['write'] : ['write', 'success']);
        }
    }
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
