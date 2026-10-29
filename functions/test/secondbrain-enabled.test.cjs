const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
function fixture(enabled) {
    let config = { enabled };
    const ref = { collection: () => ref, doc: () => ref, get: async () => ({ data: () => config }) };
    const context = { ...require('../lib/template-catalog'), workspaceTemplate: require('../lib/workspace-purchase').workspaceTemplate, db: { collection: () => ref } };
    vm.createContext(context);
    const helper = source.slice(source.indexOf('async function assertSecondBrainEnabled('), source.indexOf('async function reconcileSecondBrainPage('));
    const start = source.indexOf('async function processWebhookEvent(');
    const worker = source.slice(start, source.indexOf('//////////////////////////////////////////////////////////////////////', start));
    vm.runInContext(ts.transpile(helper + worker, { target: ts.ScriptTarget.ES2020 }), context);
    return { context, set: value => { config = value; } };
}
test('OFF and missing settings stop webhook before any Notion or AI call', async () => {
    for (const enabled of [false, undefined, null, 'true']) {
        const { context } = fixture(enabled);
        await assert.rejects(context.processWebhookEvent('user', 'token', 'page'), /SECOND_BRAIN_AUTOMATION_DISABLED/);
    }
});
test('guard re-reads settings and stops work after ON changes to OFF', async () => {
    const f = fixture(true);
    await f.context.assertSecondBrainEnabled('user');
    f.set({ enabled: false });
    await assert.rejects(f.context.assertSecondBrainEnabled('user'), error => error.statusCode === 409);
});
test('manual batch after cache reset remains blocked while OFF', async () => {
    const f = fixture(false);
    const config = { enabled: false, cacheResetInProgress: false, cacheGeneration: 2, accessKey: 'key' };
    const ref = { collection: () => ref, doc: () => ref, get: async () => ({ exists: true, data: () => config }) };
    Object.assign(f.context, { db: { collection: () => ref }, exports: {}, onRequest: (_, fn) => fn, withCors: fn => fn });
    const batch = source.slice(source.indexOf('export const generateNotionNoteKMDataBatch'), source.indexOf('async function assertSecondBrainEnabled('));
    vm.runInContext(ts.transpileModule(batch, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f.context);
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await f.context.exports.generateNotionNoteKMDataBatch({ method: 'POST', body: { userId: 'user' }, headers: { authorization: 'Bearer key' } }, res);
    assert.equal(res.code, 409);
    assert.equal(res.body.error, 'SECOND_BRAIN_AUTOMATION_DISABLED');
});

test('planner and scrapbook cannot extract even when manually enabled', async () => {
    for (const templateId of ['lifeupPlanner', 'lifeUpScrapbook']) {
        const f = fixture(true); f.set({ templateId, enabled: true });
        await assert.rejects(f.context.processWebhookEvent('user', 'token', 'page'), /SECOND_BRAIN_AUTOMATION_DISABLED/);
    }
});
