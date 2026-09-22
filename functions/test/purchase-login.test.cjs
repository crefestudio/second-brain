const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPurchaseLogin } = require('../lib/purchase-login');

function setup() {
    const data = new Map();
    const tokens = [];
    const sent = [];
    let purchased = true;
    let disabled = false;
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
                    .map(([p, v]) => ({ id: p.split('/').at(-1), data: () => v })),
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
                    update: (ref, value) => writes.push([ref.path, value, true]) });
                for (const [p, v, merge] of writes) data.set(p, merge ? { ...data.get(p), ...v } : v);
                return result;
            });
            queue = execution.catch(() => {});
            return execution;
        }
    };
    const users = new Map();
    const auth = {
        getUser: async uid => ({ uid, disabled }),
        getUserByEmail: async email => {
            if (!users.has(email)) throw { code: 'auth/user-not-found' };
            return users.get(email);
        },
        createUser: async ({ email }) => { const user = { uid: 'new-firebase-user', disabled: false }; users.set(email, user); return user; },
        createCustomToken: async uid => { tokens.push(uid); return 'token-for-' + uid; }
    };
    const service = createPurchaseLogin({ db, auth,
        send: async (email, code) => { if (sendFailure) throw Error('mail failed'); sent.push({ email, code }); },
        purchase: async () => purchased ? { purchaser: { email: 'buyer@example.com' }, purchaserIds: ['p1'], memberType: 'standard' } : null
    });
    return { data, service, tokens, sent, setPurchased: value => purchased = value,
        setDisabled: value => disabled = value, failSend: () => sendFailure = true,
        challenge: () => [...data.values()].find(value => 'codeHash' in value) };
}
const email = 'buyer@example.com';

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
        if (mode === 'conflict') h.data.set('appAccounts/google-user', { userId: 'someone-else' });
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
