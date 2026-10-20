const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file, require) {
    const context = { exports: {}, require };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, context);
    return context.exports;
}
const entry = compile('src/app/config/app-entry.ts', () => require('../lib/template-catalog'));
async function enter(query, session, purchase) {
    const calls = [];
    const router = { createUrlTree: (path, options) => ({ path: path[0], ...options }) };
    const auth = { error: { set() {} }, session: async (_id, target) => { calls.push(target); if (session instanceof Error) throw session; return session; } };
    const guard = compile('src/app/services/auth.guard.ts', name => {
        if (name === '@angular/router') return { Router: 'router' };
        if (name === '@angular/core') return { inject: token => token === 'router' ? router : auth };
        if (name.endsWith('/app-entry')) return entry;
        if (name.endsWith('/user.service')) return { UserService: { getPurchaseInfo: async () => purchase } };
        return {};
    }).memberGuard;
    return { result: await guard({ queryParamMap: { get: () => query } }, { url: '/workspace/connect' }), calls };
}
test('anonymous app entry preserves destination and canonical target', async () => {
    const { result, calls } = await enter('lifeup', null, null);
    assert.equal(result.path, '/login');
    assert.equal(result.queryParams.templateId, 'lifeUp');
    assert.equal(result.queryParams.returnUrl, '/workspace/connect');
    assert.deepEqual(calls, ['lifeUp']);
});
test('verified workspace enters without a Notion connection; unverified purchase is blocked', async () => {
    const session = { userId: 'planner', templateId: 'lifeupPlanner', notionConnected: false };
    assert.equal((await enter('lifeupPlanner', session, { verified: true })).result, true);
    assert.equal((await enter('lifeupPlanner', session, { verified: false })).result.path, '/verify-purchase');
});
test('another verified template cannot satisfy the requested target', async () => {
    const { result } = await enter('lifeUpScrapbook', { userId: 'lifeup', templateId: 'lifeUp' }, { verified: true });
    assert.equal(result.path, '/verify-purchase');
    assert.equal(result.queryParams.templateId, 'lifeUpScrapbook');
});
test('untargeted entry uses current workspace, and unknown templates fail closed', async () => {
    assert.equal((await enter(null, { userId: 'planner', templateId: 'lifeupPlanner' }, { verified: true })).result, true);
    assert.equal((await enter('invalid', null, null)).result.path, '/unauthorized');
});
test('return destinations cannot leave the app or loop through verification', () => {
    for (const url of ['//evil.test', 'https://evil.test', '/verify-purchase', '/workspace\\evil']) {
        assert.equal(entry.safeAppReturn(url), '/workspace/home');
    }
    assert.equal(entry.safeAppReturn('/workspace/connect?templateId=lifeup'), '/workspace/connect?templateId=lifeup');
});
test('session lookup failure offers login retry instead of purchase verification', async () => {
    const { result } = await enter('lifeup', new Error('network failure'), null);
    assert.equal(result.path, '/login');
    assert.equal(result.queryParams.templateId, 'lifeUp');
    assert.equal(result.queryParams.returnUrl, '/workspace/connect');
});
test('only signed-in accounts without a workspace reach untargeted selection', async () => {
    assert.equal((await enter(null, null, null)).result.path, '/login');
    const { result } = await enter(null, { userId: '', workspaces: [] }, null);
    assert.equal(result.path, '/verify-purchase');
    assert.equal(result.queryParams.templateId, undefined);
});
