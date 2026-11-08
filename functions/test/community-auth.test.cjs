const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { CommunityError } = require('../lib/community');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const statement = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'communityApi'));
const compiled = ts.transpileModule(statement.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
async function request(options = {}) {
  const logs = [], calls = [], verified = [];
  const context = { exports: {}, Error, CommunityError, ADMIN_EMAILS: new Set(['operator@example.test']),
    onRequest: (options, handler) => { context.options = options; return handler; },
    admin: { auth: () => ({ verifyIdToken: async (...args) => { verified.push(args); if (options.authError) throw options.authError; return { uid: 'verified-user' }; }, getUser: async () => ({ emailVerified: options.verified !== false, displayName: 'Member', email: options.email || 'member@example.test' }) }) },
    db: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ deletionStatus: options.pending ? 'pending' : '' }) }) }) }) },
    communityService: async (...args) => { calls.push(args); return { ok: true }; }, logger: { error: (...args) => logs.push(args) } };
  vm.runInNewContext(compiled, context);
  const res = { code: 200, headers: {}, set(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await context.exports.communityApi({ method: options.method || 'POST', headers: options.noToken ? {} : { authorization: 'Bearer test-token' }, body: { action: 'feed', uid: 'spoofed', isAdmin: true } }, res);
  return { res, logs, calls, verified, options: context.options };
}
test('community rejects unauthenticated, invalid, unverified and deleting accounts without operational alerts', async () => {
  for (const [options, status] of [[{ noToken: true }, 401], [{ authError: Object.assign(new Error('sensitive'), { code: 'auth/id-token-expired' }) }, 401], [{ verified: false }, 403], [{ pending: true }, 403], [{ method: 'GET' }, 405]]) {
    const r = await request(options); assert.equal(r.res.code, status); assert.equal(r.calls.length, 0); assert.equal(r.logs.length, 0);
  }
});
test('community trusts verified identity, checks revocation and keeps private responses uncached', async () => {
  const r = await request();
  assert.equal(r.calls[0][0].uid, 'verified-user'); assert.equal(r.calls[0][0].isAdmin, false);
  assert.deepEqual(r.verified[0], ['test-token', true]); assert.equal(r.res.headers['Cache-Control'], 'private, no-store');
  assert.ok(r.options.cors.includes('https://community.notionable.net'));
  assert.equal((await request({ email: 'operator@example.test' })).calls[0][0].isAdmin, true);
});
test('unexpected authentication failures remain monitored without leaking diagnostics', async () => {
  const r = await request({ authError: Object.assign(new Error('private diagnostic'), { code: 'auth/internal-error' }) });
  assert.equal(r.res.code, 500); assert.equal(r.logs.length, 1); assert.ok(!r.res.body.error.includes('private diagnostic'));
});
