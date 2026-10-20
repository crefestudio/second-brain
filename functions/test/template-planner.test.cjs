const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../lib/template-catalog');
const { workspaceTemplate } = require('../lib/workspace-purchase');
const { summarizeProductSales } = require('../lib/sales-summary');
const { addCustomerGrade } = require('../lib/customer-grades');
const { imwebPurchasedItems } = require('../lib/imweb-order-items');

test('three templates retain distinct IDs; unknown IDs cannot inherit LifeUp permissions', () => {
    assert.equal(workspaceTemplate({}), 'lifeUp');
    for (const templateId of catalog.TEMPLATE_IDS) assert.equal(workspaceTemplate({ templateId }), templateId);
    for (const templateId of ['lifeUpPanner', 'typo', '__proto__']) {
        assert.throws(() => workspaceTemplate({ templateId }), /INVALID_TEMPLATE_ID/);
        assert.equal(catalog.canUseAgent(templateId, 'routine'), false);
    }
    assert.equal(catalog.templateDownloadPath('lifeupPlanner'), '/download/lifeup-planner');
    assert.ok(fs.existsSync('public/templateDownload/' + catalog.TEMPLATE_PRODUCTS.lifeupPlanner.pdfFileName));
});

test('agent permissions distinguish planner from scrapbook and never enable unknown agents', () => {
    assert.equal(catalog.canUseAgent('lifeupPlannerLite', 'routine'), false);
    assert.equal(catalog.canUseAgent('lifeupPlannerLite', 'secondbrain'), false);
    assert.equal(catalog.TEMPLATE_PRODUCTS.lifeupPlannerLite.displayPrice, 0);
    assert.equal(catalog.templateDownloadPath('lifeupPlannerLite'), '/download/lifeup-planner-lite');
    assert.equal(catalog.canUseAgent('lifeupPlanner', 'routine'), true);
    assert.equal(catalog.canUseAgent('lifeupPlanner', 'secondbrain'), false);
    assert.equal(catalog.canUseAgent('lifeUpScrapbook', 'routine'), false);
    assert.equal(catalog.canUseAgent('lifeUpScrapbook', 'secondbrain'), false);
    for (const id of catalog.TEMPLATE_IDS) {
        assert.equal(catalog.canUseAgent(id, 'kakao-capture'), true);
        assert.equal(catalog.canUseAgent(id, 'unknown'), false);
    }
});

test('routine server checks template permission even if its enabled flag is true', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const start = source.indexOf('async function isRoutineAutomationEnabled(');
    const fn = source.slice(start, source.indexOf('function sendRoutineAutomationDisabled(', start));
    for (const [templateId, enabled, expected] of [['lifeupPlanner', true, true], ['lifeupPlanner', false, false], ['lifeUpScrapbook', true, false], ['lifeUp', undefined, true]]) {
        const ref = { doc: () => ref, collection: () => ref, get: async () => ({ data: () => ({ templateId, enabled }) }) };
        const context = { ...catalog, workspaceTemplate, db: { collection: () => ref } };
        vm.runInNewContext(ts.transpile(fn, { target: ts.ScriptTarget.ES2020 }), context);
        assert.equal(await context.isRoutineAutomationEnabled('user'), expected);
    }
});

test('planner and scrapbook sales use actual paid amounts and stay outside LifeUp totals', () => {
    const rows = [
        { templateId: 'lifeupPlanner', paymentAmount: 19000 },
        { templateId: 'lifeUpScrapbook', paymentAmount: 9000 },
        { templateId: 'lifeupPlanner', paymentAmount: 29000 },
        { templateId: 'lifeupPlanner', paymentAmount: 0 }
    ].map(row => ({ ...row, source: 'imweb', purchasedAt: '2026.10.16', purchaseOption: '' }));
    assert.deepEqual(summarizeProductSales(rows, '2026-10'), {
        'lifeup-planner': { count: 2, revenue: 48000, freeCount: 1 }, 'lifeup-scrapbook': { count: 1, revenue: 9000 }
    });
});

test('customer keeps a single grade with premium then standard above individual templates', () => {
    const grades = new Map();
    for (const grade of ['planner', 'standard', 'scrapbook', 'premium', 'planner']) addCustomerGrade(grades, '010-1234-5678', grade);
    assert.equal(grades.get('01012345678'), 'premium');
    const planner = new Map();
    addCustomerGrade(planner, '01012345678', 'planner');
    assert.equal(planner.get('01012345678'), 'planner');
});

test('basket imports every registered SKU using item payments rather than repeating order total', () => {
    const rows = { list: [{ items: [
        { prod_sku_no: 'lifeup', payment: { price: 79000, coupon: 10000 } },
        { prod_sku_no: 'planner', payment: { price: 29000 } }
    ] }] };
    const result = imwebPurchasedItems(rows, new Set(['lifeup', 'planner']), 98000);
    assert.deepEqual(result.map(x => [x.sku, x.paymentAmount]), [['lifeup', 69000], ['planner', 29000]]);
    assert.equal(result.reduce((n, x) => n + x.paymentAmount, 0), 98000);
});

test('single-item orders keep order payment compatibility; missing multi-item amounts fail explicitly', () => {
    assert.equal(imwebPurchasedItems([{ sku: 'planner' }], new Set(['planner']), 29000)[0].paymentAmount, 29000);
    assert.throws(() => imwebPurchasedItems([{ sku: 'planner' }, { sku: 'other' }], new Set(['planner']), 29000), /IMWEB_ITEM_PAYMENT_UNAVAILABLE/);
    assert.deepEqual(imwebPurchasedItems([{ sku: 'unregistered' }], new Set(['planner']), 29000), []);
});

test('unregistered products do not cause their payment to be attached to a registered SKU', () => {
    const rows = [{ sku: 'planner', payment: { price: 29000 } }, { sku: 'unregistered', payment: { price: 10000 } }];
    const result = imwebPurchasedItems(rows, new Set(['planner']), 39000);
    assert.equal(result.length, 1);
    assert.equal(result[0].paymentAmount, 29000);
});

test('confirmed Imweb planner SKU maps to canonical template ID with legacy aliases intact', () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const start = source.indexOf('function imwebProductMap(');
    const fn = source.slice(start, source.indexOf('function selectBestPurchaserForTemplate(', start));
    const context = { ...catalog, IMWEB_PRODUCT_SKU_MAP: { value: () => JSON.stringify({legacy: { templateId: 'lifeUp', memberType: 'premium' }}) } };
    vm.runInNewContext(ts.transpile(fn, { target: ts.ScriptTarget.ES2020 }), context);
    const map = context.imwebProductMap();
    assert.equal(map.get('lifeUpPlanner').templateId, 'lifeupPlanner');
    assert.equal(map.get('lifeUpPlannerLite').templateId, 'lifeupPlannerLite');
    assert.equal(map.get('legacy').memberType, 'premium');
});

test('each individual product queues its own welcome links once per recipient across retries', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'receiveLifeupPlannerPurchase');
    for (const templateId of catalog.TEMPLATE_IDS.filter(id => !['lifeUp', 'lifeUpScrapbook'].includes(id))) {
        const deliveries = new Map(), updates = [];
        const context = { ...catalog, registerPurchaserCustomer: async () => {}, customerEmail: value => value,
            templateWelcomeMail: require('../lib/template-welcome-mail').templateWelcomeMail,
            LATPEED_ADMIN_EMAIL: 'admin@example.test', withUnsubscribe: mail => mail,
            LIFEUP_EMAIL_VARIABLES: { installYoutubeUrl: 'https://example.com/install', reviewUrl: 'https://example.com/review', lifeupbotUrl: 'https://example.com/bot', lifeupCareUrl: 'https://example.com/care' },
            admin: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
            mailQueue: { send: async (mail, priority, key) => { deliveries.set(key, mail); return { data: { id: key } }; } } };
        vm.runInNewContext(ts.transpile(fn.getText(tree), { target: ts.ScriptTarget.ES2020 }), context);
        const ref = { id: templateId + '-order', update: async value => updates.push(value) };
        for (let i = 0; i < 2; i++) await context.receiveLifeupPlannerPurchase(ref, { templateId, email: 'buyer@example.test', name: '<buyer>' });
        assert.equal(deliveries.size, 2);
        assert.ok([...deliveries.values()].every(mail => mail.text.includes(catalog.TEMPLATE_PRODUCTS[templateId].releaseUrl) && mail.text.includes(catalog.TEMPLATE_PRODUCTS[templateId].pdfFileName)));
        assert.equal(updates[0]['reception.status'], 'completed');
    }
});

test('purchase lookup accepts planner and scrapbook without applying LifeUp membership tiers', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const handler = tree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(tree) === 'verifyPurchaser'));
    const start = source.indexOf('function selectBestPurchaserForTemplate(');
    const selector = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'selectBestPurchaserForTemplate').getText(tree);
    for (const templateId of catalog.TEMPLATE_IDS.filter(id => id !== 'lifeUp')) {
        const context = { ...catalog, exports: {}, onRequest: fn => fn, withCors: fn => fn,
            findPurchaserRecords: async id => id === templateId ? [{ id: 'purchase', data: { templateId, email: 'buyer@example.test' } }] : [],
            isLifeupUpgrade: () => false, purchaserTimestamp: () => 1,
            selectBestPurchaser: () => { throw new Error('LifeUp tier selection must not run'); }, console };
        vm.runInNewContext(ts.transpileModule(selector + handler.getText(tree), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        await context.exports.verifyPurchaser({ body: { templateId, email: 'buyer@example.test' } }, res);
        assert.equal(res.code, 200);
        assert.equal(res.body.purchaser.templateId, templateId);
    }
});
