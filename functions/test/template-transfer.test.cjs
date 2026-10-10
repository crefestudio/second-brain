const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseIdentity, detectTransfer, discoverTransferDatabases, transferPlanKey } = require('../lib/template-transfer');
const db = (id, title) => ({ id, title });
const source = db('source', 'note / 15 / ScrapBook');
const target = db('target', 'note / 15');

test('slashes, legacy hashes, separator spacing and case identify the same database', () => {
    for (const title of ['note / 15 / ScrapBook', 'note/15/ScrapBook', 'NOTE #15# SCRAPBOOK', ' note # 15 / scrapbook ']) {
        assert.deepEqual(databaseIdentity(title), ['note', '15', 'scrapbook']);
        assert.equal(detectTransfer([db('s', title), target], ['note']).pairs.note.source, 's');
    }
});
test('multiple different DBs auto-detect one template; absent DBs are skipped', () => {
    const result = detectTransfer([source, target, db('m', 'memo/15/ScrapBook'), db('mt', 'memo#15')], ['note', 'memo', 'habit']);
    assert.equal(result.template, 'scrapbook');
    assert.deepEqual(Object.keys(result.pairs), ['note', 'memo']);
    assert.deepEqual(result.skipped, ['habit']);
});
test('different individual template kinds are an error even in different DBs', () => {
    assert.throws(() => detectTransfer([source, target, db('m', 'memo/15/Memo')], ['note', 'memo']), /여러 개별 템플릿/);
});
test('two copies of the same source DB are an error', () => {
    assert.throws(() => detectTransfer([source, target, db('other', 'note#15#scrapbook')], ['note']), /원본 DB가 여러/);
});
test('missing target and duplicate targets are errors', () => {
    assert.throws(() => detectTransfer([source], ['note']), /통합 1.5 DB를 찾을/);
    assert.throws(() => detectTransfer([source, target, db('other', 'note#15')], ['note']), /통합 1.5 DB가 여러/);
});
test('integrated-to-integrated is not an individual source', () => {
    assert.throws(() => detectTransfer([target, db('other', 'note#15')], ['note']), /개별 1.5 템플릿을 찾지/);
});
test('exact DB, version and segment count prevent prefix matches', () => {
    for (const title of ['notebook/15/ScrapBook', 'note/150/ScrapBook', 'note/15/ScrapBook/backup', 'note/15/']) {
        assert.throws(() => detectTransfer([db('s', title), target], ['note']));
    }
});
test('duplicate search results for the same database ID are not duplicate installations', () => {
    assert.equal(detectTransfer([source, source, target], ['note']).pairs.note.source, 'source');
});
test('plan identity is stable after Firestore reorders object fields', () => {
    const a = { template: 'scrapbook', pairs: { note: { source: 's', target: 't' }, memo: { source: 'm', target: 'n' } }, skipped: ['habit', 'task'] };
    const b = { template: 'scrapbook', skipped: ['task', 'habit'], pairs: { memo: { target: 'n', source: 'm' }, note: { target: 't', source: 's' } } };
    assert.equal(transferPlanKey(a), transferPlanKey(b));
    b.pairs.note.source = 'different';
    assert.notEqual(transferPlanKey(a), transferPlanKey(b));
});
test('search paginates and mixed templates on later pages still block', async () => {
    const original = global.fetch;
    const calls = [];
    global.fetch = async (_, options) => {
        calls.push(JSON.parse(options.body));
        return { ok: true, json: async () => calls.length === 1
            ? { results: [{ id: 's', title: [{ plain_text: source.title }] }, { id: 't', title: [{ plain_text: target.title }] }], has_more: true, next_cursor: 'next' }
            : { results: [{ id: 'm', title: [{ plain_text: 'memo/15/Memo' }] }], has_more: false } };
    };
    try {
        const results = await discoverTransferDatabases('fake-token');
        assert.equal(calls[1].start_cursor, 'next');
        assert.throws(() => detectTransfer(results, ['note', 'memo']), /여러 개별 템플릿/);
    } finally { global.fetch = original; }
});
test('search failures never become an absent source', async () => {
    const original = global.fetch;
    global.fetch = async () => ({ ok: false, status: 403 });
    try { await assert.rejects(discoverTransferDatabases('fake-token'), /DB 검색에 실패/); }
    finally { global.fetch = original; }
});
