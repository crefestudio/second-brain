const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deleteAccountData } = require('../lib/account-deletion');

function fixture() {
    const data = new Map([
        ['appAccounts/me', { userId: 'foreign' }],
        ['users/owned', { firebaseUid: 'me', accessKey: 'secret' }],
        ['users/owned/integrations/routine', { records: true }],
        ['users/foreign', { firebaseUid: 'other', email: 'me@example.com' }],
        ['careRequests/request', { ownerId: 'me' }],
        ['careRequests/other', { ownerId: 'other' }],
        ['kakaoConnections/chat', { userId: 'owned' }],
        ['kakao_verifications/owned', {}],
        ['purchasers/payment', { email: 'me@example.com' }]
    ]);
    let deletedAuth = false;
    let fail = false;
    const attachments = [];
    const removedCustomerEmails = [];
    const ref = path => ({ path, id: path.split('/').at(-1),
        get: async () => ({ exists: data.has(path), data: () => data.get(path) }),
        set: async value => data.set(path, value), delete: async () => data.delete(path) });
    const db = {
        collection: name => ({ doc: id => ref(`${name}/${id}`), where: (field, op, value) => ({ get: async () => ({
            docs: [...data].filter(([path, item]) => path.split('/').length === 2 && path.startsWith(name + '/') && item[field] === value)
                .map(([path, item]) => ({ id: path.split('/')[1], ref: ref(path), data: () => item }))
        }) }) }),
        runTransaction: callback => callback({ get: ref => ref.get(), set: (ref, value) => data.set(ref.path, { ...data.get(ref.path), ...value }) }),
        recursiveDelete: async ref => {
            if (fail && ref.path === 'users/owned') throw Error('temporary failure');
            for (const key of data.keys()) if (key === ref.path || key.startsWith(ref.path + '/')) data.delete(key);
        }
    };
    const run = () => deleteAccountData(db, { getUser: async () => ({ email: 'me@example.com' }), deleteUser: async () => { deletedAuth = true; } },
        'me', async id => attachments.push(id), async email => removedCustomerEmails.push(email));
    return { data, run, attachments, removedCustomerEmails, deleted: () => deletedAuth, fail: value => fail = value };
}

test('deletes owned data and attachments, keeps foreign workspace and purchase ledger', async () => {
    const f = fixture(); await f.run();
    assert.equal(f.deleted(), true);
    assert.equal(f.data.has('users/owned'), false);
    assert.equal(f.data.has('users/owned/integrations/routine'), false);
    assert.equal(f.data.has('appAccounts/me'), false);
    assert.equal(f.data.has('kakaoConnections/chat'), false);
    assert.equal(f.data.has('careRequests/request'), false);
    assert.deepEqual(f.attachments, ['request']);
    assert.deepEqual(f.removedCustomerEmails, ['me@example.com']);
    assert.equal(f.data.has('users/foreign'), true);
    assert.equal(f.data.has('careRequests/other'), true);
    assert.equal(f.data.has('purchasers/payment'), true);
});

test('partial failure preserves retry manifest and Auth; retry finishes cleanup', async () => {
    const f = fixture(); f.fail(true);
    await assert.rejects(f.run(), /temporary failure/);
    assert.equal(f.deleted(), false);
    assert.equal(f.data.get('appAccounts/me').deletionStatus, 'pending');
    assert.equal(f.data.get('users/owned').accessKey, undefined);
    f.fail(false); await f.run();
    assert.equal(f.deleted(), true);
});
