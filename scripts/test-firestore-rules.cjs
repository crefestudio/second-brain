// Run only against the local emulator started with firestore.rules on port 8189.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8189/v1/projects/demo-lifeup-rules/databases/(default)/documents';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = uid => `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid, aud: 'demo-lifeup-rules', iss: 'https://securetoken.google.com/demo-lifeup-rules', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, firebase: { sign_in_provider: 'google.com', identities: {} } })}.`;
const fields = values => Object.fromEntries(Object.entries(values).map(([k,v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }]));
async function request(method, path, credential, values) {
  return fetch(`${base}/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(values ? { body: JSON.stringify({ fields: fields(values) }) } : {}) });
}
async function expect(label, method, path, credential, values, allowed) {
  const response = await request(method, path, credential, values);
  const body = await response.text();
  assert.equal(response.status, allowed ? 200 : 403, `${label}: ${response.status} ${body}`);
  console.log(`PASS ${label}`);
}
(async () => {
  for (const [path, data] of Object.entries({
    'appAccounts/a': { userId: 'wa' }, 'appAccounts/b': { userId: 'wb' },
    'users/wa': { firebaseUid: 'a', email: 'a@example.test' },
    'users/wb': { firebaseUid: 'b' },
    'users/wa/integrations/migration/migration/run/results/result': { status: 'ok' },
    'users/wa/integrations/secondbrain': { enabled: true },
    'email_verifications/private': { code: 'secret' }
  })) {
    const response = await request('PATCH', path, 'owner', data);
    assert.equal(response.status, 200, await response.text());
  }
  await expect('own workspace', 'GET', 'users/wa', token('a'), null, true);
  await expect('cross-account read denied', 'GET', 'users/wa', token('b'), null, false);
  await expect('anonymous denied', 'GET', 'users/wa', null, null, false);
  await expect('unbound user denied', 'GET', 'users/wa', token('c'), null, false);
  await expect('own mapping read', 'GET', 'appAccounts/a', token('a'), null, true);
  await expect('mapping hijack denied', 'PATCH', 'appAccounts/a', token('a'), { userId: 'wb' }, false);
  await expect('workspace ownership change denied', 'PATCH', 'users/wa', token('a'), { firebaseUid: 'b' }, false);
  await expect('self-certified purchase denied', 'PATCH', 'users/wa/purchases/lifeUp', token('a'), { verified: true }, false);
  await expect('nested migration read', 'GET', 'users/wa/integrations/migration/migration/run/results/result', token('a'), null, true);
  await expect('migration result tampering denied', 'PATCH', 'users/wa/integrations/migration/migration/run/results/result', token('a'), { status: 'error' }, false);
  await expect('verification code denied', 'GET', 'email_verifications/private', token('a'), null, false);
  await expect('automation toggle', 'PATCH', 'users/wa/integrations/secondbrain', token('a'), { enabled: false }, true);
  await expect('automation token injection denied', 'PATCH', 'users/wa/integrations/secondbrain', token('a'), { enabled: false, accessToken: 'fake' }, false);
})().catch(error => { console.error(error); process.exitCode = 1; });
