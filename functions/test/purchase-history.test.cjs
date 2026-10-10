const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
async function request({ authorized = true, owner = 'account', verified = true, active = 'workspace', authEmail = '', emailVerified = false } = {}) {
    let lookupEmail;
    const rows = [{ id: 'old', data: { email: 'buyer@example.com', purchaseOption: '라이프업', privateField: 'hidden', date: 1 } },
        { id: 'best', data: { email: 'buyer@example.com', purchaseOption: '라이프업', date: 2 } }];
    const linked = { verified, purchaser: { email: 'buyer@example.com' } };
    const workspaceRef = { get: async () => ({ data: () => ({ firebaseUid: owner }) }),
        collection: () => ({ doc: templateId => ({ get: async () => ({ data: () => templateId === 'lifeUp' ? linked : undefined }) }) }) };
    const context = { exports: {}, onRequest: x => x, withCors: x => x,
        admin: { auth: () => ({ verifyIdToken: async () => { if (!authorized) throw Error(); return { uid: 'account', email: authEmail, email_verified: emailVerified }; } }) },
        db: { collection: name => ({ doc: () => name === 'appAccounts'
            ? { get: async () => ({ data: () => ({ userId: active }) }) } : workspaceRef,
            where: (_field, _op, uid) => ({ get: async () => ({ docs: owner === uid ? [{ id: 'workspace', ref: workspaceRef, data: () => ({ firebaseUid: owner, templateId: 'lifeUp' }) }] : [] }) }) }) },
        findPurchaserRecords: async (templateId, email) => { lookupEmail = email; return templateId === 'lifeUp' ? rows : [{ id: 'scrapbook', data: { email, date: 3 } }]; },
        selectBestPurchaserForTemplate: (_template, records) => records.length ? { ...records.at(-1), memberType: 'premium' } : null,
        workspaceTemplate: data => data.templateId,
        purchaserTimestamp: data => data.date, lifeupMemberType: () => 'standard', isLifeupUpgrade: () => false,
        logger: { error() {} } };
    const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const handler = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'getPurchaseHistory'));
    vm.runInNewContext(ts.transpileModule(handler.getText(ast), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, context);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await context.exports.getPurchaseHistory({ method: 'POST', headers: {}, body: { email: 'other@example.com' } }, res);
    return { res, lookupEmail };
}
test('history uses verified linked email, returns all rows and marks only best active', async () => {
    const { res, lookupEmail } = await request();
    assert.equal(lookupEmail, 'buyer@example.com');
    assert.equal(res.body.purchases.length, 2);
    assert.equal(res.body.purchases[0].active, true);
    assert.equal(res.body.purchases[0].memberType, 'premium');
    assert.equal(res.body.purchases[1].active, false);
    assert.equal(res.body.purchases[1].privateField, undefined);
});
test('unauthenticated, mismatched and unverified accounts cannot read history', async () => {
    for (const [options, status] of [[{ authorized: false }, 401], [{ owner: 'other' }, 200], [{ verified: false }, 200]]) {
        const { res, lookupEmail } = await request(options);
        assert.equal(res.statusCode, status);
        assert.equal(lookupEmail, undefined);
    }
});

test('changing active workspace does not change account purchase history', async () => {
    const first = await request({ active: 'workspace' });
    const second = await request({ active: 'scrapbook-workspace' });
    assert.deepEqual(JSON.parse(JSON.stringify(first.res.body)), JSON.parse(JSON.stringify(second.res.body)));
});

test('verified Auth email retrieves both products without any workspace', async () => {
    const { res } = await request({ owner: 'other', authEmail: 'buyer@example.com', emailVerified: true });
    assert.equal(res.body.purchases.length, 3);
    assert.equal(res.body.purchases[0].templateId, 'lifeUpScrapbook');
    assert.equal(res.body.purchases[0].workspaceId, '');
    assert.equal(res.body.purchases[0].connected, false);
});

test('unverified Auth email does not authorize purchase lookup', async () => {
    const { res, lookupEmail } = await request({ owner: 'other', authEmail: 'buyer@example.com' });
    assert.equal(res.body.purchases.length, 0);
    assert.equal(lookupEmail, undefined);
});
