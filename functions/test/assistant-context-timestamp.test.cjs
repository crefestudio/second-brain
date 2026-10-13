const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const admin = require('firebase-admin');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const start = source.indexOf('function removeUndefined<T>');
const end = source.indexOf('async function resolveTargetPageId', start);

test('pending Scrapbook context retains a Firestore timestamp and can be read back', async () => {
    let saved;
    const reference = { id: 'pending', collection: () => reference, doc: () => reference,
        orderBy: () => reference, limit: () => reference };
    const db = { collection: () => reference, runTransaction: async callback => {
        let reads = 0;
        await callback({ get: async () => ++reads === 1 ? { data: () => ({}) } : { empty: true },
            set: (_ref, data) => { saved = data; } });
    } };
    const context = vm.createContext({ admin, db, connectionContextKey: () => 'connection:0' });
    vm.runInContext(ts.transpile(source.slice(start, end).replace('export async', 'async'),
        { target: ts.ScriptTarget.ES2020 }), context);
    await vm.runInContext(`saveAssistantContext('user', {
        userMessage: '빨래하기', result: { action: 'scrapbookPending', scrapbookPending: true, absent: undefined },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    })`, context);
    assert.ok(saved.createdAt instanceof admin.firestore.Timestamp);
    assert.ok(Date.now() - saved.createdAt.toDate().getTime() < 5000);
    assert.equal(saved.result.scrapbookPending, true);
    assert.equal('absent' in saved.result, false);
    assert.equal(saved.userMessage, '빨래하기');
});

test('cleanup preserves SDK sentinels and removes nested undefined values', () => {
    const context = vm.createContext({ admin });
    vm.runInContext(ts.transpile(source.slice(start, source.indexOf('export async function saveAssistantContext', start)),
        { target: ts.ScriptTarget.ES2020 }), context);
    assert.equal(vm.runInContext(`(() => {
        const sentinel = admin.firestore.FieldValue.serverTimestamp();
        const cleaned = removeUndefined({ sentinel, nested: [{ keep: 1, omit: undefined }] });
        return cleaned.sentinel === sentinel && !('omit' in cleaned.nested[0]);
    })()`, context), true);
});
