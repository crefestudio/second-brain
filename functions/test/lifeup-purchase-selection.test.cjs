const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const context = {};
vm.runInNewContext(ts.transpileModule(source.slice(source.indexOf('const LIFEUP_TEST_PURCHASER_EMAILS'), source.indexOf('async function findPurchaserRecords(')), {}).outputText, context);
const record = (id, option, date, amount = '10,000원') => ({ id, data: { purchaseOption: option, amount, purchasedAt: date } });
test('zero amounts are excluded before premium keywords; paid options follow product keywords', () => {
    for (const option of ['라이프업', '라이프업 프리미엄', '커스터마이징']) {
        assert.equal(context.lifeupMemberType({ purchaseOption: option, amount: 0 }), null);
    }
    assert.equal(context.lifeupMemberType(record('', '라이프업 할일 관리', '').data), 'standard');
    assert.equal(context.lifeupMemberType(record('', '라이프업 커스터마이징', '').data), 'premium');
    assert.equal(context.lifeupMemberType(record('', '다른 상품', '').data), null);
});
test('premium wins over newer standard; same tier uses purchase date, not import date', () => {
    const old = record('old', '라이프업 프리미엄', '26.09.01');
    old.data.createdAt = { toMillis: () => Date.now() };
    const recent = record('recent', '라이프업 프리미엄', '26.09.02');
    const standard = record('standard', '라이프업', '26.09.23');
    assert.equal(context.selectBestPurchaser([old, standard, recent]).id, 'recent');
    assert.equal(context.selectBestPurchaser([record('a', '라이프업', '26.09.01'), standard]).id, 'standard');
});
test('upgrade changes only effective tier and cannot grant a template by itself', () => {
    const upgrade = record('upgrade', '프리미엄 승격', '26.09.23');
    const base = record('base', '라이프업', '26.09.01');
    assert.equal(context.selectBestPurchaser([upgrade]), null);
    const best = context.selectBestPurchaser([base, upgrade]);
    assert.equal(best.id, 'base');
    assert.equal(best.data, base.data);
    assert.equal(best.memberType, 'premium');
    assert.equal(context.lifeupMemberType(base.data), 'standard');
});
