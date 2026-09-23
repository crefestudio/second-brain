const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
async function request({ authorized = true, owner = 'account', verified = true } = {}) {
    let lookupEmail;
    const rows = [{ id: 'old', data: { email: 'buyer@example.com', purchaseOption: '라이프업', privateField: 'hidden', date: 1 } },
        { id: 'best', data: { email: 'buyer@example.com', purchaseOption: '라이프업', date: 2 } }];
    const linked = { verified, purchaser: { email: 'buyer@example.com' } };
    const workspaceRef = { get: async () => ({ data: () => ({ firebaseUid: owner }) }),
        collection: () => ({ doc: () => ({ get: async () => ({ data: () => linked }) }) }) };
    const context = { exports: {}, onRequest: x => x, withCors: x => x,
        admin: { auth: () => ({ verifyIdToken: async () => { if (!authorized) throw Error(); return { uid: 'account' }; } }) },
        db: { collection: name => ({ doc: () => name === 'appAccounts'
            ? { get: async () => ({ data: () => ({ userId: 'workspace' }) }) } : workspaceRef }) },
        findPurchaserRecords: async (_, email) => { lookupEmail = email; return rows; },
        selectBestPurchaser: () => ({ ...rows[1], memberType: 'premium' }),
        purchaserTimestamp: data => data.date, lifeupMemberType: () => 'standard', isLifeupUpgrade: () => false,
        logger: { error() {} } };
    vm.runInNewContext(ts.transpileModule(source.slice(source.indexOf('export const getPurchaseHistory ='), source.indexOf('export const getAppSession =')), {
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
    for (const [options, status] of [[{ authorized: false }, 401], [{ owner: 'other' }, 403], [{ verified: false }, 200]]) {
        const { res, lookupEmail } = await request(options);
        assert.equal(res.statusCode, status);
        assert.equal(lookupEmail, undefined);
    }
});
