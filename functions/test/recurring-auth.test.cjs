const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const handler = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'manageRecurringSchedules'));
const compiled = ts.transpileModule(handler.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

async function rejectIdentity(error) {
    const logs = [];
    const context = { exports: {}, Error, onRequest: (_options, fn) => fn, withCors: fn => fn,
        getCareIdentity: async () => { throw error; }, logger: { error: (...args) => logs.push(args) } };
    vm.runInNewContext(compiled, context);
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await context.exports.manageRecurringSchedules({ method: 'POST', body: {} }, res);
    return { res, logs };
}

test('expected authentication rejections do not emit operational errors or expose SDK details', async () => {
    for (const code of [null, 'auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found']) {
        const error = new Error(code ? 'private SDK diagnostic' : 'LOGIN_REQUIRED');
        error.code = code;
        const { res, logs } = await rejectIdentity(error);
        assert.equal(res.code, 401); assert.equal(logs.length, 0);
        assert.ok(!res.body.error.includes('private SDK diagnostic'));
    }
});

test('pending account deletion is forbidden without an operational alert', async () => {
    const { res, logs } = await rejectIdentity(new Error('ACCOUNT_DELETION_PENDING'));
    assert.equal(res.code, 403); assert.equal(logs.length, 0);
});

test('unexpected authentication infrastructure errors remain visible to monitoring', async () => {
    const error = Object.assign(new Error('Authentication service unavailable'), { code: 'auth/internal-error' });
    const { logs } = await rejectIdentity(error);
    assert.equal(logs.length, 1);
});
