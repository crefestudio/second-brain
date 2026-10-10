const { test } = require('node:test');
const assert = require('node:assert/strict');
const { purchaseEmailError } = require('../lib/purchase-email-policy');

test('signed-in purchase linking requires a verified, matching Auth email', () => {
    assert.ok(purchaseEmailError({}));
    assert.ok(purchaseEmailError({ email: 'buyer@example.com', email_verified: false }));
    assert.ok(purchaseEmailError({ email: 'buyer@example.com', email_verified: true }, 'other@example.com'));
    assert.equal(purchaseEmailError({ email: 'Buyer@example.com', email_verified: true }, ' buyer@example.com '), null);
});
