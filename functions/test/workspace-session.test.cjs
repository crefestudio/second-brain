const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { workspaceTemplate } = require('../lib/workspace-purchase');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const handler = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'getAppSession'));
const compiled = ts.transpileModule(handler.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

async function request(body = {}, options = {}) {
    const account = { userId: 'lifeup', ...options.account };
    const docs = [{ id: 'lifeup', data: () => ({ firebaseUid: 'owner' }) },
        { id: 'scrapbook', data: () => ({ firebaseUid: 'owner', templateId: 'lifeUpScrapbook', kakaoUserId: 'kakao2', notionAccessToken: 'secret' }) }];
    let writes = 0;
    const context = { exports: {}, onRequest: fn => fn, withCors: fn => fn, workspaceTemplate,
        purchaseEmailError: require('../lib/purchase-email-policy').purchaseEmailError,
        admin: { auth: () => ({ verifyIdToken: async () => { if (options.unauthorized) throw Error(); return { uid: 'owner', email: 'buyer@example.com', email_verified: true }; } }),
            firestore: { FieldValue: { delete: () => null, serverTimestamp: () => 1 } } },
        db: { collection: name => ({ doc: id => ({ name, id }), where: (_field, _operator, uid) => ({ name, uid }) }),
            runTransaction: async fn => fn({
                get: async ref => ref.name === 'appAccounts' ? { exists: true, data: () => account } : { docs: ref.uid === 'owner' ? docs : [] },
                set: (_ref, values) => { writes++; Object.assign(account, values); }
            }) }, logger: { error() {} } };
    vm.runInNewContext(compiled, context);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await context.exports.getAppSession({ method: 'POST', headers: {}, body }, res);
    return { res, account, writes };
}

test('session lists template names and selecting an owned workspace changes active binding', async () => {
    const { res, account } = await request({ userId: 'scrapbook' });
    assert.equal(res.code, 200);
    assert.equal(account.userId, 'scrapbook');
    assert.equal(res.body.templateId, 'lifeUpScrapbook');
    assert.equal(res.body.workspaces.map(w => w.name).join(','), '라이프업,라이프업 스크랩북');
    assert.equal(res.body.notionConnected, true);
    assert.equal(res.body.notionAccessToken, undefined);
});

test('download selects only its product; ordinary lookup preserves active workspace', async () => {
    assert.equal((await request({ templateId: 'lifeUpScrapbook' })).account.userId, 'scrapbook');
    const result = await request({}, { account: { userId: 'scrapbook' } });
    assert.equal(result.res.body.userId, 'scrapbook');
    assert.equal(result.writes, 0);
});

test('foreign selection, unauthenticated requests, and deletion-pending accounts cannot switch', async () => {
    for (const [body, options, status] of [[{ userId: 'foreign' }, {}, 403], [{}, { unauthorized: true }, 401],
        [{ userId: 'scrapbook' }, { account: { deletionStatus: 'pending' } }, 409]]) {
        const result = await request(body, options);
        assert.equal(result.res.code, status);
        assert.equal(result.writes, 0);
    }
});
