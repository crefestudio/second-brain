const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/app/components/pages/myPage/pages/lifeup-download/lifeup-download.component.ts', 'utf8');

function setup(signedIn = false) {
    let account = signedIn ? { uid: 'existing' } : null;
    let verified = false;
    let failure = false;
    const calls = [];
    const context = { exports: {}, require: name => name === '@angular/core'
        ? { Component: () => target => target, inject: () => ({
            lifeUpReleaseUrls: { '1.5': 'https://example.test/lifeup-1.5' },
            lifeUpPassportUrls: { '1.5': '/templateDownload/LifeUp1.5.pdf' }
        }) }
        : name.endsWith('/user.service') ? { UserService: {
            updatePurchaseInfo: async () => ({ isPurchaser: true, purchaseInfo: { verified } })
        } } : {} };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true
    } }).outputText, context);
    const social = { init: async () => {}, account: () => account, error: () => 'invalid code',
        requestPurchaseCode: async () => { calls.push('request-login'); return true; },
        loginWithPurchase: async () => {
            calls.push('login');
            if (failure) return false;
            account = { uid: 'purchaser' }; verified = true; return true;
        } };
    const user = { sendVerificationEmail: async () => { calls.push('request-link'); return true; },
        verifyCode: async () => { calls.push('link'); verified = true; return { userId: 'workspace' }; } };
    const auth = { updateSession: async () => {}, getUserId: () => account ? 'workspace' : '' };
    const page = new context.exports.LifeupDownloadComponent(auth, user, {}, social);
    page.verificationValue = 'buyer@example.com'; page.verificationCode = '123456';
    return { page, calls, fail: () => { failure = true; }, setVerified: value => { verified = value; },
        switchAccount: () => { account = { uid: 'other' }; } };
}

test('anonymous visitor can load and purchase verification establishes a session', async () => {
    const h = setup();
    await h.page.ngOnInit();
    assert.equal(h.page.isLoading, false);
    assert.equal(h.page.isPurchaser, false);
    await h.page.verifyPurchase(); h.page.verificationCode = '123456';
    await h.page.confirmVerification();
    assert.deepEqual(h.calls, ['request-login', 'login']);
    assert.equal(h.page.isPurchaser, true);
    await h.page.ngOnInit();
    assert.equal(h.page.isPurchaser, true);
});

test('signed-in account links purchase without replacing its Firebase identity', async () => {
    const h = setup(true);
    await h.page.verifyPurchase(); h.page.verificationCode = '123456';
    await h.page.confirmVerification();
    assert.deepEqual(h.calls, ['request-link', 'link']);
    assert.equal(h.page.isPurchaser, true);
});

test('failed authentication and changed accounts do not reveal downloads', async () => {
    for (const mode of ['failure', 'changed']) {
        const h = setup();
        await h.page.verifyPurchase(); h.page.verificationCode = '123456';
        if (mode === 'failure') h.fail(); else h.switchAccount();
        await h.page.confirmVerification();
        assert.equal(h.page.isPurchaser, false);
        assert.ok(h.page.verificationError);
    }
});

test('stored purchase must be verified, while verified sessions restore access', async () => {
    const h = setup(true);
    await h.page.ngOnInit(); assert.equal(h.page.isPurchaser, false);
    h.setVerified(true);
    await h.page.ngOnInit(); assert.equal(h.page.isPurchaser, true);
});
