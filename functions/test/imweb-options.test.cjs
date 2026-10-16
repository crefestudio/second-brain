const { test } = require('node:test');
const assert = require('node:assert/strict');
const { imwebPurchaseOption } = require('../lib/imweb-options');
const { summarizeProductSales } = require('../lib/sales-summary');

test('reads nested selected values from the matching item, not another item or option labels', () => {
    const data = { data: [{ items: [
        { prod_sku_no: 'other', prod_name: 'Other', options: [[{ value_name_list: ['Wrong'] }]] },
        { prod_sku_no: 'lifeUp', prod_name: 'LIFEUP', options: [[{ option_name_list: ['상품 옵션'], value_name_list: ['라이프업 올인원'] }, { value_name_list: ['얼리버드'] }]] }
    ] }] };
    assert.equal(imwebPurchaseOption(data, 'lifeUp'), '라이프업 올인원 / 얼리버드');
    assert.equal(imwebPurchaseOption(data, 'missing'), '');
});
test('uses product name for absent or empty options and preserves legacy options', () => {
    for (const options of [undefined, [], [[{ value_name_list: [] }]]]) {
        assert.equal(imwebPurchaseOption({ prod_sku_no: 'template', prod_name: 'LIFEUP Template', options }, 'template'), 'LIFEUP Template');
    }
    assert.equal(imwebPurchaseOption({ sku: 'lifeUp', option_name: 'Legacy', prod_name: 'Product' }, 'lifeUp'), 'Legacy');
});
test('counts approved Imweb lifeUp sales regardless of display language or options', () => {
    const rows = ['', 'LIFEUP Template', '얼리버드'].map(purchaseOption => ({
        source: 'imweb', templateId: 'lifeUp', purchasedAt: '26.10.15 17:22', paymentAmount: 79000, purchaseOption
    }));
    assert.deepEqual(summarizeProductSales(rows, '2026-10'), { 'lifeup-imweb': { count: 3, revenue: 237000 } });
});
