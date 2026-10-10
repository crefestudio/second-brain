const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function status(user, session, transfer = false) {
    const source = fs.readFileSync(require.resolve('../lib/index'), 'utf8');
    const start = source.indexOf('exports.getMigrationConnectionStatus = (');
    const end = source.indexOf('exports.getMigrationTemplateRootUrl =', start);
    assert.ok(start > 0 && end > start);
    const records = new Map([['users/u', user], ['users/u/integrations/migrationSession', session]]);
    const ref = path => ({ get: async () => ({ data: () => records.get(path) }), collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }) });
    const context = {
        exports: {}, console, https_1: { onRequest: fn => fn }, withCors: fn => fn,
        db: { collection: name => ({ doc: id => ref(`${name}/${id}`) }) },
        isTemplateTransfer: () => transfer, requireTransferOwner: async () => {}
    };
    vm.runInNewContext(source.slice(start, end), context);
    let result;
    const response = { status() { return this; }, json(value) { result = value; return this; } };
    await context.exports.getMigrationConnectionStatus({ method: 'POST', body: { userId: 'u' } }, response);
    return result;
}
for (const transfer of [false, true]) {
    const mode = transfer ? 'templateTransfer' : 'migration';
    const other = transfer ? 'migration' : 'templateTransfer';
    const prefix = transfer ? 'notionTemplateTransfer' : 'notionMigration';
    test(`${mode}: no connection has no conflict or cancel action`, async () => {
        const result = await status({}, undefined, transfer);
        assert.equal(result.status, 'disconnected');
        assert.equal(result.hasOwnSession, false);
        assert.equal(result.message, undefined);
    });
    test(`${mode}: pending OAuth can be cancelled after reload without a notice`, async () => {
        const result = await status({}, { mode, awaitingOAuth: true }, transfer);
        assert.equal(result.status, 'pending');
        assert.equal(result.hasOwnSession, true);
        assert.equal(result.message, undefined);
    });
    test(`${mode}: connected owner can disconnect without a notice`, async () => {
        const result = await status({ [`${prefix}AccessToken`]: 'token', [`${prefix}ConnectionStatus`]: 'connected' }, { mode }, transfer);
        assert.equal(result.connected, true);
        assert.equal(result.hasOwnSession, true);
        assert.equal(result.message, undefined);
    });
    test(`${mode}: only the conflicting screen shows a named notice`, async () => {
        const result = await status({}, { mode: other, awaitingOAuth: true }, transfer);
        assert.equal(result.status, 'blocked');
        assert.equal(result.hasOwnSession, false);
        assert.ok(result.message.includes(transfer ? '1.3 → 1.5 업데이트' : '개별 1.5 템플릿 이전'));
    });
    test(`${mode}: tokenless leftover lock is cancellable by its owner`, async () => {
        const result = await status({}, { mode }, transfer);
        assert.equal(result.hasOwnSession, true);
        assert.equal(result.message, undefined);
    });
}
