const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function fixture(extra = {}) {
    const records = new Map(Object.entries({
        'users/u': { notionAccessToken: 'token', notionConnectionId: 'n1', notionDbCacheRevision: 0,
            kakaoUserId: 'k1', firebaseUid: 'owner', notionConnection: { status: 'connected', databases: { note: 'old', task: 'task-old' } },
            lifeupTemplateInfo: { pageUrls: { root: 'old-url' } } },
        'users/u/integrations/secondbrain': { accessToken: 'token', noteDatabaseId: 'old', connectionId: 'n1', enabled: true, cacheGeneration: 2 },
        'users/u/integrations/secondbrain/pages/p': { keywords: ['keep'] },
        'users/u/integrations/migration': { datasources: { note_13: 'keep-migration' } },
        'users/u/integrations/templateTransfer': { migrationRunId: 'keep-transfer' },
        'notionDatabaseMap/old': { userId: 'u', accessToken: 'token' },
        'notionDatabaseMap/other': { userId: 'other', accessToken: 'other-token' },
        'kakaoConnections/k1': { uid: 'u', userId: 'u', enabled: true, connectionId: 'k-old' },
        ...extra
    }));
    const clone = value => value === undefined ? undefined : structuredClone(value);
    const snapshot = path => ({ exists: records.has(path), id: path.split('/').at(-1), ref: ref(path), data: () => clone(records.get(path)) });
    function ref(path) { return { path, collection: name => ref(`${path}/${name}`), doc: id => ref(`${path}/${id}`),
        get: async () => snapshot(path), where: (field, _op, value) => ({ path, field, value }) }; }
    function write(reference, patch, merge = true) {
        const value = merge ? clone(records.get(reference.path) || {}) : {};
        for (const [key, next] of Object.entries(patch)) {
            const parts = key.split('.');
            let target = value;
            for (const part of parts.slice(0, -1)) target = target[part] ||= {};
            const last = parts.at(-1);
            if (next?.deleteField) delete target[last];
            else if (next?.increment) target[last] = (target[last] || 0) + next.increment;
            else target[last] = clone(next);
        }
        records.set(reference.path, value);
    }
    const db = { collection: name => ref(name), runTransaction: async fn => {
        const writes = [];
        const result = await fn({ get: async reference => reference.field ? {
            docs: [...records.keys()].filter(path => path.startsWith(`${reference.path}/`) &&
                path.split('/').length === reference.path.split('/').length + 1 && records.get(path)[reference.field] === reference.value).map(snapshot)
        } : snapshot(reference.path),
        update: (reference, patch) => writes.push(() => write(reference, patch)),
        set: (reference, patch, opts) => writes.push(() => write(reference, patch, !!opts?.merge)),
        delete: reference => writes.push(() => records.delete(reference.path)) });
        writes.forEach(fn => fn()); return result;
    } };
    const context = { ...require('../lib/template-catalog'), db, randomUUID: () => 'fresh-connection', console: { log() {}, error() {}, warn() {} },
        templateDatabaseNames: async () => ['note', 'task'],
        NotionService: { updateTemplateDbs: async () => ({ note: 'new-note', task: 'new-task' }),
            getDatabaseIdByDatabaseName: async (_token, name) => `new-${name}`,
            resolveDataSourceId: async () => 'source', fetchLifeupTemplateInfoFromNotion: async () => null,
            resetKeywordOptions: async () => { assert.fail('must not reset keyword options'); } },
        admin: { firestore: { FieldValue: { delete: () => ({ deleteField: true }), increment: n => ({ increment: n }), serverTimestamp: () => 1 } } } };
    vm.createContext(context);
    const code = section('async function replaceNotionConnection(', 'export const disconnectNotionTemplate') +
        '\n' + section('async function completeNotionTemplateConnection(', 'export enum AgentId') +
        '\n' + section('export async function connectKakaoUser(', 'export const disconnectKakao =').replaceAll('export async', 'async') +
        '\n' + section('export async function findEnabledConnectedUser(', '/////////////////////////////////////////////////////////////').replaceAll('export async', 'async') +
        '\n' + section('async function assertKakaoJobConnection(', 'function guardedNotionClient(') +
        '\nclass CacheResolver {' + section('    static async resolveDatabaseId(', '    static async resolveDataSourceId(') + '}\nglobalThis.CacheResolver = CacheResolver;';
    vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2020 }), context);
    return { records, context, user: () => records.get('users/u') };
}

test('Notion disconnect removes all connection copies but preserves graphs and migration records', async () => {
    const { context, records, user } = fixture();
    await context.replaceNotionConnection('u');
    assert.equal(user().notionAccessToken, undefined);
    assert.equal(user().notionConnection.status, 'disconnected');
    assert.deepEqual(user().notionConnection.databases, {});
    assert.equal(records.get('users/u/integrations/secondbrain').accessToken, undefined);
    assert.equal(records.get('users/u/integrations/secondbrain').cacheGeneration, 3);
    assert.deepEqual(records.get('users/u/integrations/secondbrain/pages/p').keywords, ['keep']);
    assert.ok(records.has('users/u/integrations/migration'));
    assert.ok(records.has('users/u/integrations/templateTransfer'));
    assert.equal(records.has('notionDatabaseMap/old'), false);
    assert.equal(records.has('notionDatabaseMap/other'), true);
    assert.equal(records.has('kakaoConnections/k1'), true);
});
test('reconnect enters pending with empty DB cache and cannot use previous token', async () => {
    const { context, records, user } = fixture();
    await context.replaceNotionConnection('u', { accessToken: 'new-token', workspaceId: 'w2' });
    assert.equal(user().notionAccessToken, 'new-token');
    assert.equal(user().notionConnection.status, 'pending');
    assert.deepEqual(user().notionConnection.databases, {});
    assert.equal(context.isUsableNotionConnection(user(), 'new-token'), false);
    assert.equal(records.get('users/u/integrations/secondbrain').enabled, true);
    assert.ok(records.has('users/u/integrations/secondbrain/pages/p'));
});
test('successful reconnect replaces the full DB map and preserves graph and enabled preference', async () => {
    const { context, records, user } = fixture();
    await context.replaceNotionConnection('u', { accessToken: 'new-token' });
    await context.completeNotionTemplateConnection('u', 'new-token');
    assert.deepEqual(user().notionConnection.databases, { note: 'new-note', task: 'new-task' });
    assert.equal(user().notionConnection.status, 'connected');
    const sb = records.get('users/u/integrations/secondbrain');
    assert.equal(sb.noteDatabaseId, 'new-note');
    assert.equal(sb.accessToken, 'new-token');
    assert.equal(sb.enabled, true);
    assert.deepEqual(records.get('users/u/integrations/secondbrain/pages/p').keywords, ['keep']);
    assert.equal(records.get('notionDatabaseMap/new-note').connectionId, user().notionConnectionId);
});
test('discovery reports every DB and leaves connection pending when one lookup fails', async () => {
    const { context, user } = fixture();
    await context.replaceNotionConnection('u', { accessToken: 'new-token' });
    context.NotionService.getDatabaseIdByDatabaseName = async (_token, name) => {
        if (name === 'task') throw vm.runInContext("new Error('Database title mismatch')", context);
        return 'new-note';
    };
    const checks = [];
    await assert.rejects(context.completeNotionTemplateConnection('u', 'new-token', undefined, undefined, undefined, checks), /task/);
    assert.equal(checks.find(item => item.name === 'note').status, 'found');
    assert.equal(checks.find(item => item.name === 'task').message, 'Database title mismatch');
    assert.equal(user().notionConnection.status, 'pending');
});
test('failed OAuth validation is not usable and fresh OAuth clears previous failure', async () => {
    const { context, user } = fixture({ 'users/u': { notionAccessToken: 'token', notionConnectionId: 'failed-id',
        notionConnection: { status: 'failed', errorCode: 'DUPLICATE_DATABASE', errorMessage: 'duplicate' } } });
    assert.equal(context.isUsableNotionConnection(user()), false);
    await context.replaceNotionConnection('u', { accessToken: 'new-token' });
    assert.equal(user().notionConnection.status, 'pending');
    assert.equal(user().notionConnection.errorCode, undefined);
    assert.equal(context.isUsableNotionConnection(user()), false);
});
test('discovery finishing after disconnect cannot restore any connection metadata', async () => {
    const { context, records, user } = fixture();
    await context.replaceNotionConnection('u', { accessToken: 'new-token' });
    context.NotionService.getDatabaseIdByDatabaseName = async (_token, name) => {
        await context.replaceNotionConnection('u');
        return `new-${name}`;
    };
    await assert.rejects(context.completeNotionTemplateConnection('u', 'new-token'), /NOTION_CONNECTION_CHANGED/);
    assert.equal(user().notionConnection.status, 'disconnected');
    assert.equal(records.has('notionDatabaseMap/new-note'), false);
});
test('delayed template links cannot recreate a disconnected Kakao binding', async () => {
    const { context, records } = fixture();
    await context.disconnectKakaoUser('u', 'k1');
    await context.cacheTemplateInfo('u', 'token', 'n1', { pageUrls: { root: 'new-url' } });
    assert.equal(records.has('kakaoConnections/k1'), false);
    await context.replaceNotionConnection('u');
    await assert.rejects(context.cacheTemplateInfo('u', 'token', 'n1', { pageUrls: {} }), /NOTION_CONNECTION_CHANGED/);
});
test('Kakao disconnect invalidates common cache without disconnecting Notion or graph', async () => {
    const { context, records, user } = fixture();
    await context.disconnectKakaoUser('u', 'k1');
    assert.equal(user().kakaoUserId, undefined);
    assert.deepEqual(user().notionConnection.databases, {});
    assert.equal(user().notionAccessToken, 'token');
    assert.equal(records.get('users/u/integrations/secondbrain').accessToken, 'token');
    assert.equal(records.has('kakaoConnections/k1'), false);
    assert.equal(user().notionDbCacheRevision, 1);
});
test('Kakao switch removes reverse mapping and old job is rejected', async () => {
    const { context, records } = fixture();
    const oldJob = { kakaoUserId: 'k1', kakaoConnectionId: 'k-old', notionConnectionId: 'n1' };
    await context.assertKakaoJobConnection('u', oldJob);
    assert.equal(await context.connectKakaoUser('u', 'k2'), 'connected');
    assert.equal(records.has('kakaoConnections/k1'), false);
    await assert.rejects(context.assertKakaoJobConnection('u', oldJob), /KAKAO_CONNECTION_CHANGED/);
    await context.assertKakaoJobConnection('u', { ...oldJob, kakaoUserId: 'k2', kakaoConnectionId: 'fresh-connection' });
});
test('disconnect cannot delete a Kakao mapping owned by another workspace', async () => {
    const { context, records } = fixture({ 'kakaoConnections/k1': { uid: 'other' } });
    await assert.rejects(context.disconnectKakaoUser('u', 'k1'), /KAKAO_CONNECTION_CHANGED/);
    assert.equal(records.get('kakaoConnections/k1').uid, 'other');
});
test('Kakao cannot silently claim another account connection', async () => {
    const { context, records } = fixture({ 'kakaoConnections/k2': { uid: 'other' }, 'users/other': { firebaseUid: 'other-owner' } });
    assert.equal(await context.connectKakaoUser('u', 'k2'), 'already-connected-to-another-account');
    assert.equal(records.get('kakaoConnections/k2').uid, 'other');
});
test('legacy queued jobs and jobs from a previous Notion connection are held, not reassigned', async () => {
    const { context, user } = fixture();
    await assert.rejects(context.assertKakaoJobConnection('u', { kakaoUserId: 'k1' }), /LEGACY_JOB/);
    user().notionConnectionId = 'n2';
    await assert.rejects(context.assertKakaoJobConnection('u', { kakaoUserId: 'k1', kakaoConnectionId: 'k-old', notionConnectionId: 'n1' }), /KAKAO_CONNECTION_CHANGED/);
});
test('valid database cache is validated and reused', async () => {
    const { context } = fixture();
    context.CacheResolver.resolveDataSourceId = async () => 'source';
    context.CacheResolver.getDatabaseIdByDatabaseName = async () => { throw new Error('must not search'); };
    assert.equal(await context.CacheResolver.resolveDatabaseId('token', 'u', 'note'), 'old');
});
test('404 database recovery updates both common and secondbrain cache', async () => {
    const { context, records, user } = fixture();
    context.CacheResolver.resolveDataSourceId = async (_token, id) => {
        if (id === 'old') throw { status: 404, code: 'object_not_found' };
        return 'new-source';
    };
    context.CacheResolver.getDatabaseIdByDatabaseName = async () => 'new';
    assert.equal(await context.CacheResolver.resolveDatabaseId('token', 'u', 'note'), 'new');
    assert.equal(user().notionConnection.databases.note, 'new');
    assert.equal(records.get('users/u/integrations/secondbrain').noteDatabaseId, 'new');
    assert.ok(records.has('users/u/integrations/secondbrain/pages/p'));
});
test('auth, rate-limit and timeout errors do not invalidate cache or trigger search', async () => {
    for (const error of [{ status: 401, code: 'unauthorized' }, { status: 429 }, new Error('timeout')]) {
        const { context, user } = fixture();
        context.CacheResolver.resolveDataSourceId = async () => { throw error; };
        context.CacheResolver.getDatabaseIdByDatabaseName = async () => { assert.fail('unexpected search'); };
        await assert.rejects(context.CacheResolver.resolveDatabaseId('token', 'u', 'note'));
        assert.equal(user().notionConnection.databases.note, 'old');
    }
});
test('ambiguous search never populates a replacement cache', async () => {
    const { context, user } = fixture();
    context.CacheResolver.resolveDataSourceId = async () => { throw { status: 404, code: 'object_not_found' }; };
    context.CacheResolver.getDatabaseIdByDatabaseName = async () => { throw new Error('multiple databases'); };
    await assert.rejects(context.CacheResolver.resolveDatabaseId('token', 'u', 'note'), /multiple databases/);
    assert.equal(user().notionConnection.databases.note, undefined);
});
test('in-flight search cannot repopulate cache after Notion or Kakao switch', async () => {
    for (const switchConnection of [user => { user.notionConnectionId = 'n2'; }, user => { user.notionDbCacheRevision++; }]) {
        const { context, user } = fixture();
        user().notionConnection.databases = {};
        context.CacheResolver.resolveDataSourceId = async () => 'source';
        context.CacheResolver.getDatabaseIdByDatabaseName = async () => { switchConnection(user()); return 'new'; };
        await assert.rejects(context.CacheResolver.resolveDatabaseId('token', 'u', 'note'), /NOTION_CONNECTION_CHANGED/);
        assert.deepEqual(user().notionConnection.databases, {});
    }
});

test('planner cache discovery stays scoped to Planner databases', async () => {
    const { context, user } = fixture();
    user().templateId = 'lifeupPlanner';
    user().notionConnection.databases = {};
    context.CacheResolver.resolveDataSourceId = async () => 'source';
    context.CacheResolver.getDatabaseIdByDatabaseName = async (token, name, version, templateId) => {
        assert.equal(templateId, 'lifeupPlanner');
        assert.equal(name, 'task');
        return 'planner-task';
    };
    assert.equal(await context.CacheResolver.resolveDatabaseId('token', 'u', 'task'), 'planner-task');
});
