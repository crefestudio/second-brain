const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPurchaseInvitations } = require('../lib/purchase-invitations');

function fixture() {
    const data = new Map();
    let queue = Promise.resolve();
    const ref = path => ({ path, id: path.split('/').at(-1),
        doc: id => ref(`${path}/${id}`),
        get: async () => ({ exists: data.has(path), data: () => data.get(path) }),
        create: async value => { assert.equal(data.has(path), false); data.set(path, value); }
    });
    const db = { collection: ref, runTransaction: callback => {
        const next = queue.then(async () => {
            const pending = [];
            const result = await callback({ get: r => r.get(),
                create: (r, v) => { assert.equal(data.has(r.path), false); pending.push([r.path, v]); },
                update: (r, v) => pending.push([r.path, { ...data.get(r.path), ...v }]) });
            for (const [p, v] of pending) data.set(p, v);
            return result;
        });
        queue = next.catch(() => {});
        return next;
    } };
    return { data, service: createPurchaseInvitations(db, () => '26.10.01 12:00'),
        purchases: () => [...data.entries()].filter(([key]) => key.startsWith('purchasers/')).map(([, v]) => v),
        invitation: () => [...data.entries()].find(([key]) => key.startsWith('purchaseInvitations/'))[1] };
}

test('fixed normalized email and tier produce a paid eligible invitation without consent or account creation', async () => {
    for (const memberType of ['standard', 'premium']) {
        const f = fixture();
        const created = await f.service.create(' Guest@Example.com ', memberType, 'admin');
        assert.match(created.token, /^[a-f0-9]{64}$/);
        assert.equal(f.invitation().token, undefined);
        assert.equal((await f.service.inspect(created.token)).email, 'guest@example.com');
        await f.service.redeem(created.token, '초대 고객', '010-1234-5678');
        const purchase = f.purchases()[0];
        assert.equal(purchase.email, 'guest@example.com');
        assert.equal(purchase.memberType, memberType);
        assert.equal(purchase.amount, '1원');
        assert.equal(purchase.notify, '미응답');
        assert.equal(purchase.purchaseEligible, true);
        assert.match(purchase.purchaseOption, /라이프업 1.5 .* 초대장/);
        assert.equal(f.data.size, 2);
        assert.equal((await f.service.inspect(created.token)).redeemed, true);
    }
});

test('concurrent and repeated redemption creates one purchase and cannot replace its name or phone', async () => {
    const f = fixture(); const { token } = await f.service.create('guest@example.com', 'premium', 'admin');
    const results = await Promise.all([f.service.redeem(token, 'Original', '01012345678'), f.service.redeem(token, 'Replacement', '01099999999')]);
    assert.deepEqual(results.map(r => r.alreadyRegistered), [false, true]);
    assert.equal(f.purchases().length, 1);
    assert.equal(f.purchases()[0].name, 'Original');
});

test('invalid, expired, cancelled, and malformed submissions do not register purchases', async () => {
    const f = fixture();
    await assert.rejects(f.service.create('bad', 'premium', 'admin'), { status: 400 });
    await assert.rejects(f.service.create('guest@example.com', 'owner', 'admin'), { status: 400 });
    await assert.rejects(f.service.inspect('invalid'), { status: 404 });
    await assert.rejects(f.service.inspect('a'.repeat(64)), { status: 404 });
    const { token } = await f.service.create('guest@example.com', 'premium', 'admin');
    await assert.rejects(f.service.redeem(token, '', '01012345678'), { status: 400 });
    await assert.rejects(f.service.redeem(token, 'Guest', 'abc'), { status: 400 });
    f.invitation().expiresAt = 0;
    await assert.rejects(f.service.redeem(token, 'Guest', '01012345678'), { status: 410 });
    f.invitation().expiresAt = Date.now() + 10000; f.invitation().status = 'cancelled';
    await assert.rejects(f.service.redeem(token, 'Guest', '01012345678'), { status: 410 });
    assert.equal(f.purchases().length, 0);
});
