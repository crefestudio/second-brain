const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../lib/template-catalog');
const source = fs.readFileSync('functions/src/index.ts', 'utf8');
const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const pieces = tree.statements.filter(n =>
    ts.isFunctionDeclaration(n) && n.name?.text === 'manualPurchaseText' ||
    ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(tree) === 'createManualLifeupPurchase'));
const code = ts.transpileModule(pieces.map(n => n.getText(tree)).join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
async function request(product, isAdmin = true) {
    const writes = [];
    const context = { ...catalog, exports: {}, onRequest: x => x, withCors: x => x,
        getCareIdentity: async () => ({ isAdmin, email: 'admin@example.test' }),
        db: { collection: () => ({ doc: id => ({ id, create: async data => writes.push(data) }) }) },
        admin: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
        nanoid: () => 'test', formatLatpeedDate: x => x, logger: { error() {} } };
    vm.runInNewContext(code, context);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await context.exports.createManualLifeupPurchase({ method: 'POST', body: {
        product, name: 'Buyer', email: 'buyer@example.test', phone: '01012345678', amount: 19000, purchasedAt: '2026-10-20T00:00:00Z'
    } }, res);
    return { res, writes };
}
test('every catalog product can be manually registered with the right product and eligibility', async () => {
    for (const option of catalog.PRODUCT_OPTIONS) {
        const { res, writes } = await request(option.id);
        assert.equal(res.statusCode, 201);
        assert.equal(writes[0].templateId, option.templateId);
        assert.equal(writes[0].purchaseEligible, true);
        assert.equal(writes[0].purchaseOption, option.name);
    }
});
test('unknown products and non-admin requests cannot write orders', async () => {
    for (const [product, admin, status] of [['__proto__', true, 400], ['secondBrain', false, 403]]) {
        const { res, writes } = await request(product, admin);
        assert.equal(res.statusCode, status);
        assert.equal(writes.length, 0);
    }
});
test('premium upgrade retains its original entitlement semantics', async () => {
    const { writes } = await request('upgrade');
    assert.equal(writes[0].templateId, 'lifeUp');
    assert.equal(writes[0].memberType, 'premium');
    assert.equal(writes[0].upgradeOnly, true);
    assert.equal(writes[0].purchaseEligible, false);
    assert.equal(writes[0].purchaseOption, '프리미엄 승격');
});
