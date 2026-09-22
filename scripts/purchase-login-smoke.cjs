const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = 'https://notionable.net';
const base = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';

(async () => {
    for (const name of ['requestPurchaseLoginCode', 'verifyPurchaseLoginCode']) {
        const preflight = await fetch(`${base}/${name}`, { method: 'OPTIONS', headers: {
            Origin: origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'
        } });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
        // Invalid payload only: never send mail, create accounts, or mutate real user data.
        const invalid = await fetch(`${base}/${name}`, { method: 'POST', headers: {
            Origin: origin, 'Content-Type': 'application/json'
        }, body: '{}' });
        assert.equal(invalid.status, 400);
        assert.equal(invalid.headers.get('cache-control'), 'no-store');
        assert.equal(invalid.headers.get('access-control-allow-origin'), origin);
        console.log(name + ': CORS and input rejection passed');
    }
    const expected = fs.readFileSync('dist/second-brain-app/browser/index.html', 'utf8').match(/main-[A-Z0-9]+\.js/)[0];
    const response = await fetch('https://app.notionable.net/login', { cache: 'no-store' });
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(expected), 'Production must serve the new app bundle');
    console.log('Hosting: new login bundle is live');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
