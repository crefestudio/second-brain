const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');

test('only authenticated admins can create invitations; redemption ignores client email and tier', async () => {
    let identity = null; const calls = [];
    const exports = {};
    const context = { exports, onRequest: handler => handler, withCors: handler => handler,
        getCareIdentity: async () => { if (!identity) throw Error('LOGIN_REQUIRED'); return identity; },
        APP_PUBLIC_URL: 'https://app.example.com', InvitationError: require('../lib/purchase-invitations').InvitationError,
        purchaseInvitations: {
            create: async (...args) => { calls.push(args); return { email: args[0], memberType: args[1], token: 'secret', expiresAt: 123 }; },
            redeem: async (...args) => { calls.push(args); return { success: true }; }
        }
    };
    vm.createContext(context);
    const handlers = source.slice(source.indexOf('export const createLifeupInvitation'), source.indexOf('export const latpeedPaymentWebhook'));
    vm.runInContext(ts.transpile(handlers, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), context);
    const response = () => ({ code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
    const req = { method: 'POST', body: { email: 'guest@example.com', memberType: 'premium' } };
    let res = response(); await exports.createLifeupInvitation(req, res); assert.equal(res.code, 401);
    identity = { uid: 'member', isAdmin: false };
    res = response(); await exports.createLifeupInvitation(req, res); assert.equal(res.code, 403); assert.equal(calls.length, 0);
    identity = { uid: 'admin', isAdmin: true };
    res = response(); await exports.createLifeupInvitation(req, res); assert.equal(res.code, 200); assert.equal(calls[0][2], 'admin');
    await exports.redeemLifeupInvitation({ method: 'POST', body: { token: 'token', name: 'Guest', phone: '01012345678', email: 'attacker@example.com', memberType: 'premium', amount: '999999' } }, response());
    assert.deepEqual(calls[1], ['token', 'Guest', '01012345678']);
});

function fixture() {
    const queued = new Map(); const customers = []; const promoted = [];
    let fail = true;
    const context = {
        registerPurchaserCustomer: async p => customers.push(p.email),
        promoteExistingLifeupMembers: async email => promoted.push(email),
        customerEmail: e => e.trim().toLowerCase(), LATPEED_ADMIN_EMAIL: 'admin@example.com',
        LIFEUP_EMAIL_VARIABLES: { lifeupTemplateReleaseUrl: 'https://example.com' },
        lifeupWelcomeMail: () => ({ subject: 'welcome' }), lifeupPremiumWelcomeMail: () => ({ subject: 'premium' }), withUnsubscribe: m => m,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 123 } } },
        mailQueue: { send: async (mail, priority, key) => {
            if (mail.subject === 'premium' && fail) throw Error('temporary failure');
            queued.set(key, mail); return { data: { id: key } };
        } }
    };
    vm.createContext(context);
    const selection = source.slice(source.indexOf('const LIFEUP_TEST_PURCHASER_EMAILS'), source.indexOf('async function findPurchaserRecords'));
    const receive = source.slice(source.indexOf('async function receiveLifeupPurchase'), source.indexOf('async function registerPurchaserCustomer'));
    vm.runInContext(ts.transpile(selection + '\n' + receive, { target: ts.ScriptTarget.ES2020 }), context);
    return { queued, customers, promoted, recover: () => fail = false,
        receive: p => context.receiveLifeupPurchase({ id: 'purchase', update: async () => {} }, p) };
}

test('all sources enqueue general and premium mail using stable keys across a partial failure retry', async () => {
    for (const source of ['invitation', 'latpeed', 'csv', 'other']) {
        const f = fixture();
        const purchase = { source, email: 'guest@example.com', purchaseOption: '라이프업 1.5 프리미엄 초대장', amount: '1원' };
        await assert.rejects(f.receive(purchase), /temporary failure/);
        assert.equal(f.queued.size, 2);
        f.recover(); await f.receive(purchase); await f.receive(purchase);
        assert.equal(f.queued.size, 4);
        assert.ok(f.customers.includes(purchase.email));
        assert.ok(f.promoted.includes(purchase.email));
    }
});

test('standard sends no premium mail; zero amount sends no purchase mail', async () => {
    const f = fixture();
    await f.receive({ email: 'guest@example.com', purchaseOption: '라이프업 1.5 일반 초대장', amount: '1원' });
    assert.equal(f.queued.size, 2);
    const free = fixture();
    await free.receive({ email: 'guest@example.com', purchaseOption: '라이프업 프리미엄', amount: '0원' });
    assert.equal(free.queued.size, 0);
});

test('invitation customer registration does not turn unanswered consent into opt-out', async () => {
    const records = []; const consents = [];
    const ref = {};
    const context = { customerPhone: p => p.replace(/\D/g, ''), customerEmail: e => e.toLowerCase(),
        findCustomerRefByEmail: async () => ref, customerDocumentId: p => p, customerEmailDocumentId: e => e,
        admin: { firestore: { FieldValue: { serverTimestamp: () => 123 } } },
        db: { runTransaction: async fn => fn({ get: async () => ({ data: () => ({}) }), set: (_, data) => records.push(data) }) },
        setCurrentCustomerConsent: async (...args) => consents.push(args), customerHasNotification: v => v === '예' };
    vm.createContext(context);
    const fn = source.slice(source.indexOf('async function registerPurchaserCustomer'), source.indexOf('export const validateLifeupPurchaserCsv'));
    vm.runInContext(ts.transpile(fn, { target: ts.ScriptTarget.ES2020 }), context);
    await context.registerPurchaserCustomer({ name: 'Guest', phone: '01012345678', email: 'guest@example.com', notify: '미응답' });
    assert.equal(records.length, 1); assert.equal(records[0].notificationConsent, undefined); assert.equal(consents.length, 0);
    await context.registerPurchaserCustomer({ name: 'Guest', phone: '01012345678', email: 'guest@example.com', notify: '예' });
    assert.equal(consents.length, 1); assert.equal(consents[0][1], true);
});
