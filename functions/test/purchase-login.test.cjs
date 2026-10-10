const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPurchaseLogin } = require('../lib/purchase-login');
const { bindWorkspacePurchase, WorkspaceConflict } = require('../lib/workspace-purchase');

test('one account has separate product workspaces and repeat claims reuse them', async () => {
    const h = setup();
    const purchase = { purchaser: { email }, memberType: 'standard', purchaserIds: ['p1'] };
    const lifeup = await bindWorkspacePurchase(h.db, 'owner', email, 'lifeUp', purchase);
    const scrapbook = await bindWorkspacePurchase(h.db, 'owner', email, 'lifeUpScrapbook', purchase);
    assert.notEqual(lifeup, scrapbook);
    assert.equal(h.data.get('users/' + scrapbook).templateId, 'lifeUpScrapbook');
    assert.equal(h.data.get('users/' + lifeup).templateId, 'lifeUp');
    const repeated = await Promise.all(Array.from({ length: 3 }, () => bindWorkspacePurchase(h.db, 'owner', email, 'lifeUpScrapbook', purchase)));
    assert.deepEqual(repeated, [scrapbook, scrapbook, scrapbook]);
    assert.equal(h.data.get('appAccounts/owner').userId, scrapbook);
    assert.equal(h.data.get('users/' + lifeup + '/purchases/lifeUpScrapbook'), undefined);
});

test('foreign account ownership is never overwritten', async () => {
    const h = setup();
    h.data.set('users/foreign', { email, templateId: 'lifeUpScrapbook', firebaseUid: 'other' });
    await assert.rejects(bindWorkspacePurchase(h.db, 'owner', email, 'lifeUpScrapbook', { memberType: 'standard' }), WorkspaceConflict);
    assert.equal(h.data.get('users/foreign').firebaseUid, 'other');
    assert.equal(h.data.get('appAccounts/owner'), undefined);
});

test('scrapbook purchase login reuses the account linked through another product', async () => {
    const h = setup();
    h.data.set('users/lifeup', { email, firebaseUid: 'google-user', templateId: 'lifeUp' });
    h.data.set('appAccounts/google-user', { userId: 'lifeup' });
    await h.service.request(email, 'ip', 'lifeUpScrapbook');
    const result = await h.service.verify(email, h.sent[0].code);
    assert.equal(result.token, 'token-for-google-user');
    const newId = h.data.get('appAccounts/google-user').userId;
    assert.notEqual(newId, 'lifeup');
    assert.equal(h.data.get('users/' + newId).templateId, 'lifeUpScrapbook');
    assert.equal(h.data.get('users/lifeup').templateId, 'lifeUp');
});

test('signed-in verification consumes the product-bound code once and rejects wrong products', async () => {
    const h = setup();
    const ref = h.db.collection('email_verifications').doc(email);
    const challenge = { code: 'hash', templateId: 'lifeUpScrapbook', expiresAt: { toMillis: () => Date.now() + 60000 } };
    h.data.set(ref.path, challenge);
    const purchase = { memberType: 'standard' };
    await assert.rejects(bindWorkspacePurchase(h.db, 'owner', email, 'lifeUp', purchase, { ref, hash: 'hash' }), WorkspaceConflict);
    assert.equal(h.data.has(ref.path), true);
    const results = await Promise.allSettled(Array.from({ length: 2 }, () =>
        bindWorkspacePurchase(h.db, 'owner', email, 'lifeUpScrapbook', purchase, { ref, hash: 'hash' })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(h.data.has(ref.path), false);
    assert.equal([...h.data.keys()].filter(path => /^users\/[^/]+$/.test(path)).length, 1);
});

function setup(purchaseSource = 'latpeed') {
    const data = new Map();
    const tokens = [];
    const sent = [];
    let purchased = true;
    let disabled = false;
    let accountEmail = 'buyer@example.com';
    let sendFailure = false;
    let queue = Promise.resolve();
    function reference(path, filter) {
        return {
            path, id: path.split('/').at(-1),
            collection: name => reference(path + '/' + name),
            doc: id => reference(path + '/' + id),
            where: (field, _operator, value) => reference(path, [field, value]),
            limit: () => reference(path, filter),
            get: async () => filter ? {
                docs: [...data].filter(([p, v]) => p.startsWith(path + '/') && !p.slice(path.length + 1).includes('/') && v[filter[0]] === filter[1])
                    .map(([p, v]) => ({ id: p.split('/').at(-1), ref: reference(p), data: () => v })),
                get size() { return this.docs.length; }
            } : { exists: data.has(path), data: () => data.get(path) }
        };
    }
    const db = {
        collection: name => reference(name),
        runTransaction: callback => {
            const execution = queue.then(async () => {
                const writes = [];
                const result = await callback({ get: ref => ref.get(),
                    set: (ref, value, options) => writes.push([ref.path, value, options?.merge]),
                    update: (ref, value) => writes.push([ref.path, value, true]),
                    delete: ref => writes.push([ref.path, null]) });
                for (const [p, v, merge] of writes) {
                    if (v === null) data.delete(p);
                    else data.set(p, merge ? { ...data.get(p), ...v } : v);
                }
                return result;
            });
            queue = execution.catch(() => {});
            return execution;
        }
    };
    const users = new Map();
    const auth = {
        getUser: async uid => ({ uid, disabled, email: accountEmail, emailVerified: true }),
        getUserByEmail: async email => {
            if (!users.has(email)) throw { code: 'auth/user-not-found' };
            return users.get(email);
        },
        createUser: async ({ email }) => { const user = { uid: 'new-firebase-user', disabled: false, email, emailVerified: true }; users.set(email, user); return user; },
        createCustomToken: async uid => { tokens.push(uid); return 'token-for-' + uid; }
    };
    const service = createPurchaseLogin({ db, auth,
        send: async (email, code) => { if (sendFailure) throw Error('mail failed'); sent.push({ email, code }); },
        purchase: async () => purchased ? { purchaser: { email: 'buyer@example.com', source: purchaseSource }, purchaserIds: ['p1'], memberType: 'standard' } : null
    });
    return { data, db, service, tokens, sent, setAccountEmail: value => accountEmail = value, setPurchased: value => purchased = value,
        setDisabled: value => disabled = value, failSend: () => sendFailure = true,
        challenge: () => [...data.values()].find(value => 'codeHash' in value) };
}
const email = 'buyer@example.com';

test('purchase email verification cannot log into a legacy owner with a different Auth email', async () => {
    const h = setup();
    h.data.set('users/legacy', { email, firebaseUid: 'different-account', templateId: 'lifeUpScrapbook' });
    h.setAccountEmail('different@example.com');
    await h.service.request(email, 'ip', 'lifeUpScrapbook');
    await assert.rejects(h.service.verify(email, h.sent[0].code), { status: 409 });
    assert.equal(h.tokens.length, 0);
    assert.equal(h.data.get('users/legacy').firebaseUid, 'different-account');
});

test('invitation signup explicitly requires marketing preference, without granting consent', async () => {
    const h = setup('invitation');
    await h.service.request(email, 'ip');
    await h.service.verify(email, h.sent[0].code);
    const account = h.data.get('appAccounts/new-firebase-user');
    assert.equal(account.invitationMarketingConsentRequired, true);
    assert.equal(account.marketingConsent, undefined);
});

test('existing Google binding is reused; widget credentials remain unchanged', async () => {
    const h = setup();
    h.data.set('users/workspace', { email, firebaseUid: 'google-user', accessKey: 'widget-secret' });
    h.data.set('appAccounts/google-user', { userId: 'workspace' });
    h.data.set('email_verifications/' + email, { code: 'widget-code' });
    await h.service.request(' BUYER@example.com ', 'ip');
    assert.equal(h.sent[0].email, email);
    const result = await h.service.verify(email, h.sent[0].code);
    assert.equal(result.token, 'token-for-google-user');
    assert.equal(h.data.get('users/workspace').accessKey, 'widget-secret');
    assert.equal(h.data.get('email_verifications/' + email).code, 'widget-code');
    assert.equal(h.data.get('users/workspace/purchases/lifeUp').verified, true);
});

test('new purchaser gets reciprocal ownership and a Firebase token', async () => {
    const h = setup();
    await h.service.request(email, 'ip');
    await h.service.verify(email, h.sent[0].code);
    const binding = h.data.get('appAccounts/new-firebase-user');
    assert.match(binding.userId, /^[A-Za-z0-9_-]{6}$/);
    assert.equal(h.data.get('users/' + binding.userId).firebaseUid, 'new-firebase-user');
    assert.equal(h.data.get('users/' + binding.userId).accessKey, undefined);
});

test('concurrent verification of the same code issues only one token', async () => {
    const h = setup();
    await h.service.request(email, 'ip');
    const results = await Promise.allSettled([h.service.verify(email, h.sent[0].code), h.service.verify(email, h.sent[0].code)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(h.tokens.length, 1);
});

test('failed attempts are committed and block the correct code after five failures', async () => {
    const h = setup();
    await h.service.request(email, 'ip');
    const wrong = h.sent[0].code === '111111' ? '222222' : '111111';
    await Promise.allSettled(Array.from({ length: 5 }, () => h.service.verify(email, wrong)));
    assert.equal(h.challenge().attempts, 5);
    await assert.rejects(h.service.verify(email, h.sent[0].code), { status: 401 });
    assert.equal(h.tokens.length, 0);
});

test('expired codes and non-purchasers cannot log in', async () => {
    const h = setup();
    await h.service.request(email, 'ip');
    h.challenge().expiresAt = 0;
    await assert.rejects(h.service.verify(email, h.sent[0].code), { status: 401 });
    const other = setup();
    other.setPurchased(false);
    await other.service.request(email, 'ip');
    await assert.rejects(other.service.verify(email, other.sent[0].code), { status: 403 });
    assert.equal(other.tokens.length, 0);
});

test('disabled accounts, conflicting and duplicate workspace bindings are rejected', async () => {
    for (const mode of ['disabled', 'conflict', 'duplicate']) {
        const h = setup();
        h.data.set('users/workspace', { email, firebaseUid: 'google-user' });
        if (mode === 'disabled') h.setDisabled(true);
        if (mode === 'conflict') h.data.set('users/someone-else', { email: 'other@example.com', firebaseUid: 'google-user' });
        if (mode === 'duplicate') h.data.set('users/duplicate', { email });
        await h.service.request(email, 'ip');
        await assert.rejects(h.service.verify(email, h.sent[0].code), { status: mode === 'disabled' ? 403 : 409 });
        assert.equal(h.tokens.length, 0);
    }
});

test('resend cooldown and mail delivery failure are enforced', async () => {
    const h = setup();
    await h.service.request(email, 'ip');
    await assert.rejects(h.service.request(email, 'ip'), { status: 429 });
    const failure = setup();
    failure.failSend();
    await assert.rejects(failure.service.request(email, 'ip'));
    assert.equal(failure.challenge().consumed, true);
});
