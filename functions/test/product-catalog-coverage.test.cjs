const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../lib/template-catalog');

test('every product has a purchase option, welcome mail, grade and public destination', () => {
    assert.deepEqual([...catalog.TEMPLATE_IDS].sort(), Object.keys(catalog.TEMPLATE_PRODUCTS).sort());
    for (const id of catalog.TEMPLATE_IDS) {
        const product = catalog.TEMPLATE_PRODUCTS[id];
        assert(catalog.PURCHASE_OPTIONS.some(option => option.templateId === id));
        assert(catalog.MAIL_OPTIONS.some(option => option.id === product.admin.welcomeTemplateId));
        assert(catalog.CUSTOMER_GRADES.includes(product.admin.customerGrade));
        for (const slug of catalog.templateSlugs(id)) {
            assert.equal(catalog.TEMPLATE_STORE_DESTINATIONS['store/' + slug], product.checkoutUrls.normal);
        }
        assert(fs.existsSync('public/templateDownload/' + product.pdfFileName));
    }
});

test('adding a sixth catalog entry automatically adds all derived registries', () => {
    let source = fs.readFileSync('functions/src/template-catalog.ts', 'utf8');
    source = source.replace('export const TEMPLATE_IDS =', `
        TEMPLATE_PRODUCTS.futureProduct = { ...TEMPLATE_PRODUCTS.lifeUpSecondBrainOS,
            order: 99, slug: 'future-product',
            salesUrls: { ...TEMPLATE_PRODUCTS.lifeUpSecondBrainOS.salesUrls, normal: 'https://app.notionable.net/store/future-product' },
            admin: { purchaseKey: 'future', customerGrade: 'future', welcomeTemplateId: 'future-welcome' } };
        export const TEMPLATE_IDS =`);
    const context = { exports: {}, URL };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
    const next = context.exports;
    assert(next.TEMPLATE_IDS.includes('futureProduct'));
    assert(next.PURCHASE_OPTIONS.some(option => option.id === 'future'));
    assert(next.MAIL_OPTIONS.some(option => option.id === 'future-welcome'));
    assert(next.CUSTOMER_GRADES.includes('future'));
    assert(next.TEMPLATE_STORE_DESTINATIONS['store/future-product']);
    assert.equal(next.templateDownloadPath('futureProduct'), '/download/future-product');
});
