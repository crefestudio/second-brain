const { test } = require('node:test');
const assert = require('node:assert/strict');
const { archiveWorkspace } = require('../lib/workspace-deletion');

function fixture() {
    const data = new Map([
        ['users/a', { firebaseUid: 'owner', email: 'buyer@example.com', accessKey: 'key', notionAccessToken: 'token' }],
        ['users/a/purchases/lifeUp', { verified: true }],
        ['users/b', { firebaseUid: 'owner', email: 'buyer@example.com' }],
        ['users/foreign', { firebaseUid: 'other' }],
        ['appAccounts/owner', { userId: 'a', profileName: 'Owner' }],
        ['kakaoConnections/k', { userId: 'a' }],
        ['kakaoConnections/keep', { userId: 'b' }],
        ['kakao_verifications/a', { code: 'pending' }],
        ['purchasers/p', { email: 'buyer@example.com' }]
    ]);
    function ref(path, filter) {
        return { path, id: path.split('/').at(-1), doc: id => ref(path + '/' + id),
            where: (key, op, value) => ref(path, [key, value]),
            get: async () => {
                if (!filter) return { exists: data.has(path), data: () => data.get(path) };
                const docs = [...data].filter(([key, value]) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/') && value[filter[0]] === filter[1])
                    .map(([key, value]) => ({ id: key.split('/').at(-1), ref: ref(key), data: () => value }));
                return { docs, size: docs.length };
            } };
    }
    const db = { collection: path => ref(path), runTransaction: async callback => {
        const writes = [];
        await callback({ get: ref => ref.get(), create: (ref, value) => writes.push(() => { assert.equal(data.has(ref.path), false); data.set(ref.path, value); }),
            set: (ref, value, options) => writes.push(() => data.set(ref.path, options?.merge ? { ...data.get(ref.path), ...value } : value)),
            delete: ref => writes.push(() => data.delete(ref.path)) });
        writes.forEach(write => write());
    } };
    return { db, data };
}

test('deletion archives only the selected workspace and severs credentials and bindings atomically', async () => {
    const { db, data } = fixture();
    await archiveWorkspace(db, 'owner', 'a');
    assert.equal(data.get('users/a').deletionStatus, 'archived');
    assert.equal(data.get('users/a').firebaseUid, undefined);
    assert.equal(data.get('users/a').accessKey, undefined);
    assert.equal(data.get('users/a').notionAccessToken, undefined);
    assert.equal(data.get('deletedWorkspaces/a').workspace.accessKey, 'key');
    assert.equal(data.get('users/a/purchases/lifeUp').verified, true);
    assert.equal(data.get('appAccounts/owner').userId, 'b');
    assert.equal(data.get('users/b').firebaseUid, 'owner');
    assert.equal(data.has('kakaoConnections/k'), false);
    assert.equal(data.has('kakao_verifications/a'), false);
    assert.equal(data.has('kakaoConnections/keep'), true);
    assert.equal(data.has('purchasers/p'), true);
    await archiveWorkspace(db, 'owner', 'a');
    assert.equal(data.get('deletedWorkspaces/a').workspace.accessKey, 'key');
});

test('foreign ownership and changed selection reject without any writes', async () => {
    for (const target of ['foreign', 'b']) {
        const { db, data } = fixture();
        const before = JSON.stringify([...data]);
        await assert.rejects(archiveWorkspace(db, 'owner', target), { status: target === 'foreign' ? 403 : 409 });
        assert.equal(JSON.stringify([...data]), before);
    }
});

test('deleting the only workspace preserves the login account with no selected workspace', async () => {
    const { db, data } = fixture();
    data.delete('users/b');
    await archiveWorkspace(db, 'owner', 'a');
    assert.equal(data.get('appAccounts/owner').userId, '');
    assert.equal(data.get('appAccounts/owner').profileName, 'Owner');
});
