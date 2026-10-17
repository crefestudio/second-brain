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
        'lifeup-planner': { count: 2, revenue: 48000 }, 'lifeup-scrapbook': { count: 1, revenue: 9000 }
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
    assert.equal(map.get('legacy').memberType, 'premium');
});

test('planner purchase reception queues product-specific links with stable keys for retries', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const start = source.indexOf('function lifeupPlannerWelcomeMail(');
    const fn = source.slice(start, source.indexOf('function lifeupScrapbookWelcomeMail(', start));
    const deliveries = new Map(), updates = [];
    const context = { ...catalog, registerPurchaserCustomer: async () => {}, customerEmail: value => value,
        LATPEED_ADMIN_EMAIL: 'admin@example.test', LIFEUP_PASSPORT_URL: 'https://example.test/lifeup.pdf',
        escapeEmailHtml: value => value.replace(/</g, '&lt;'), withUnsubscribe: mail => mail,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 1 } } },
        mailQueue: { send: async (mail, priority, key) => { deliveries.set(key, mail); return { data: { id: key } }; } } };
    const mailBase = source.slice(source.indexOf('const LIFEUP_EMAIL_VARIABLES ='), source.indexOf('function lifeupStandardPurchaserUpdateMailDetailed('));
    vm.runInNewContext(ts.transpile(mailBase + fn, { target: ts.ScriptTarget.ES2020 }), context);
    const preview = context.lifeupPlannerWelcomeMail('<buyer>');
    for (const output of [preview.html, preview.text]) {
        for (const expected of ['https://www.youtube.com/watch?v=0LgzGdr8luU', 'https://notionable.net/app?menu=connect', 'https://notionable.net/app?menu=care', 'https://notionable.net/lifeup-review', '~12/31', '정식 오픈 후']) assert.ok(output.includes(expected), expected);
        assert.ok(!output.includes('~10/31'));
        assert.ok(output.includes('https://www.youtube.com/shorts/QnR_gnGWOQE'));
    }
    assert.ok(preview.html.includes('max-width:640px'));
    const cardStart = preview.html.indexOf('<div style="padding:24px;background:#f8faff;border-radius:12px">');
    assert.ok(cardStart >= 0);
    const card = preview.html.slice(cardStart, preview.html.indexOf('</div>', cardStart));
    assert.ok(card.includes('리뷰 작성하고 라이프봇 1년 무료 이용권 받기'));
    assert.ok(card.includes('~12/31'));
    assert.ok(card.includes('https://notionable.net/lifeup-review'));
    const mailAst = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const scrapbookFn = mailAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'lifeupScrapbookWelcomeMail');
    vm.runInNewContext(ts.transpile(scrapbookFn.getText(mailAst)), context);
    const scrapbook = context.lifeupScrapbookWelcomeMail('');
    for (const [mail, id] of [[preview, 'lifeupPlanner'], [scrapbook, 'lifeUpScrapbook']]) {
        for (const output of [mail.html, mail.text]) {
            assert.ok(output.includes('https://notionable.net/app?templateId=' + id));
            assert.ok(output.includes('https://notionable.net/app?menu=connect&templateId=' + id));
            assert.ok(!output.includes('from=lifebot-email'));
        }
    }
    assert.ok(scrapbook.html.includes('https://www.youtube.com/shorts/QnR_gnGWOQE'));
    assert.ok(scrapbook.html.includes('LifeUp1.5-Scrapbook.pdf'));
    assert.ok(preview.html.includes('&lt;buyer>'));
    assert.ok(!preview.html.includes('<buyer>'));
    const ref = { id: 'planner-order', update: async value => updates.push(value) };
    for (let i=0; i<2; i++) await context.receiveLifeupPlannerPurchase(ref, { email: 'buyer@example.test', name: '<buyer>' });
    assert.equal(deliveries.size, 2);
    assert.ok([...deliveries.values()].every(mail => mail.text.includes(catalog.TEMPLATE_PRODUCTS.lifeupPlanner.releaseUrl) && mail.text.includes('LifeUp1.5-Planner.pdf')));
    assert.equal(updates[0]['reception.status'], 'completed');
});

test('purchase lookup accepts planner and scrapbook without applying LifeUp membership tiers', async () => {
    const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
    const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
    const handler = tree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(tree) === 'verifyPurchaser'));
    const start = source.indexOf('function selectBestPurchaserForTemplate(');
    const selector = source.slice(start, source.indexOf('async function imwebAccessToken(', start));
    for (const templateId of ['lifeupPlanner', 'lifeUpScrapbook']) {
        const context = { exports: {}, onRequest: fn => fn, withCors: fn => fn,
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
