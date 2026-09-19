const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const admin = require('firebase-admin');

let moveCalls = [];
let retrieveCalls = [];
let updateCalls = [];
let appendCalls = [];
let deleteCalls = [];
let appendSequence = 0;
let onMove;
let onUpdate;
let onListBlocks;
let currentParent = 'target';
const originalLoad = Module._load;
Module._load = function (name, ...args) {
    if (name === '@notionhq/client') return {
        LogLevel: { INFO: 'info', WARN: 'warn', ERROR: 'error' },
        Client: class {
            pages = {
                move: async ({ page_id }) => { moveCalls.push(page_id); if (onMove) await onMove(page_id); },
                update: async options => { updateCalls.push(options); if (onUpdate) await onUpdate(options); },
                retrieve: async ({ page_id }) => {
                    retrieveCalls.push(page_id);
                    return { parent: { type: 'data_source_id', data_source_id: currentParent } };
                }
            };
            blocks = {
                children: {
                    list: async ({ block_id }) => onListBlocks ? onListBlocks(block_id) : ({ results: [], has_more: false }),
                    append: async options => {
                        appendCalls.push(options);
                        return { results: options.children.map(() => ({ id: `appended-${++appendSequence}` })) };
                    }
                },
                update: async options => { updateCalls.push(options); if (onUpdate) await onUpdate(options); },
                delete: async ({ block_id }) => { deleteCalls.push(block_id); }
            };
        }
    };
    return originalLoad.call(this, name, ...args);
};
const { executeMigration, MigrationConflict, migrationErrorMessage } = require('../lib/lifeup-migration-runner');
Module._load = originalLoad;

const root = 'users/user/integrations/migration';
const runPath = `${root}/migration/run`;
const timestamp = ms => admin.firestore.Timestamp.fromMillis(ms);
const stamp = admin.firestore.FieldValue.serverTimestamp().constructor;
const deleted = admin.firestore.FieldValue.delete().constructor;

function memoryDb(seed) {
    const records = new Map(Object.entries(seed));
    function apply(path, value, merge = true) {
        const next = merge ? { ...records.get(path) } : {};
        for (const [key, item] of Object.entries(value)) {
            if (item instanceof deleted) delete next[key];
            else next[key] = item instanceof stamp ? timestamp(Date.now()) : item;
        }
        records.set(path, next);
    }
    function ref(path, filters = [], sort, max) {
        return {
            path, id: path.split('/').pop(),
            collection: name => ref(`${path}/${name}`), doc: id => ref(`${path}/${id}`),
            orderBy: (field, direction) => ref(path, filters, [field, direction], max),
            limit: count => ref(path, filters, sort, count),
            async get() {
                if (path.split('/').length % 2 === 0) return { exists: records.has(path), data: () => records.get(path) };
                let docs = [...records.entries()].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
                    .map(([key, data]) => ({ id: key.split('/').pop(), data: () => data }));
                if (sort) docs.sort((a, b) => (a.data()[sort[0]] - b.data()[sort[0]]) * (sort[1] === 'desc' ? -1 : 1));
                if (max) docs = docs.slice(0, max);
                return { docs };
            }
        };
    }
    let queue = Promise.resolve();
    return {
        records, collection: name => ref(name),
        runTransaction(operation) {
            const pending = queue.then(async () => {
                const writes = [];
                const result = await operation({
                    get: reference => reference.get(),
                    update: (reference, value) => writes.push(() => apply(reference.path, value)),
                    set: (reference, value, options) => writes.push(() => apply(reference.path, value, !!options?.merge))
                });
                writes.forEach(write => write());
                return result;
            });
            queue = pending.catch(() => {});
            return pending;
        }
    };
}
function fixture(pages, extra = {}) {
    moveCalls = []; retrieveCalls = []; updateCalls = []; appendCalls = []; deleteCalls = []; appendSequence = 0; onMove = undefined; onUpdate = undefined; onListBlocks = undefined; currentParent = 'target';
    return memoryDb({
        [root]: { migrationRunId: 'run' },
        [runPath]: { status: 'migrating', createdAt: timestamp(Date.now() - 7200000), totalCount: pages.length, ...extra },
        ...Object.fromEntries(pages.map(([id, status]) => [`${runPath}/pages/${id}`, { pageId: id, pageName: id, dbName: 'task', status }]))
    });
}
const deps = (pages = []) => ({
    entries: [['task', {}]], resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
    pages: async () => pages.map(id => ({ id, title: id }))
});

test('resume preserves completed pages and reconciles a move whose result was lost', async () => {
    const db = fixture([['done', 'complete'], ['uncertain', 'migrating'], ['pending', 'pending']]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(['pending']));
    assert.deepEqual(moveCalls, ['pending']);
    assert.deepEqual(retrieveCalls, ['uncertain']);
    assert.equal(db.records.get(runPath).completedCount, 3);
    assert.equal(db.records.get(runPath).totalCount, 3);
    assert.equal(db.records.get(runPath).success, true);
});

test('an active lease rejects a second worker', async () => {
    const db = fixture([], { workerId: 'active', leaseExpiresAt: timestamp(Date.now() + 300000) });
    await assert.rejects(executeMigration(db, 'user', 'token', 'run', 'resume', deps()), MigrationConflict);
    assert.deepEqual(moveCalls, []);
});

test('stop saves the in-flight result and resume processes only the remaining page', async () => {
    const db = fixture([['first', 'pending'], ['second', 'pending']]);
    onMove = async () => { await executeMigration(db, 'user', 'token', 'run', 'stop', deps()); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first']);
    assert.equal(db.records.get(runPath).status, 'stopped');
    assert.equal(db.records.get(runPath).completedCount, 1);
    onMove = undefined;
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first', 'second']);
    assert.equal(db.records.get(runPath).completedCount, 2);
});

test('a displaced worker cannot write a result or start the next move', async () => {
    const db = fixture([['first', 'pending'], ['second', 'pending']]);
    onMove = async () => { db.records.set(runPath, { ...db.records.get(runPath), workerId: 'successor' }); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, ['first']);
    assert.equal(db.records.get(`${runPath}/pages/first`).status, 'migrating');
    assert.equal(db.records.get(runPath).workerId, 'successor');
});

test('legacy invocation cannot be taken over before its maximum lifetime', async () => {
    const db = fixture([], { createdAt: timestamp(Date.now() - 600000) });
    await assert.rejects(executeMigration(db, 'user', 'token', 'run', 'resume', deps()), MigrationConflict);
});

test('failed pages remain unfinished and can be retried without recounting successes', async () => {
    const db = fixture([['done', 'complete'], ['retry', 'pending']]);
    onMove = async () => { throw new Error('temporary failure'); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.equal(db.records.get(runPath).success, false);
    assert.equal(db.records.get(runPath).completedCount, 1);
    onMove = undefined; currentParent = 'source';
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.equal(db.records.get(runPath).completedCount, 2);
    assert.equal(db.records.get(runPath).success, true);
});

test('expired lease permits recovery but a page moved elsewhere is not moved again', async () => {
    const db = fixture([['uncertain', 'migrating']], {
        workerId: 'expired', leaseExpiresAt: timestamp(Date.now() - 1)
    });
    currentParent = 'unrelated';
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.deepEqual(moveCalls, []);
    assert.equal(db.records.get(runPath).success, false);
    assert.equal(db.records.get(runPath).completedCount, 0);
});

test('large manifests are persisted in chunks before any move starts', async () => {
    const db = fixture([]);
    const ids = Array.from({ length: 401 }, (_, index) => `page-${index}`);
    onMove = async () => {
        assert.equal(db.records.get(runPath).totalCount, 401);
        assert.ok(db.records.has(`${runPath}/pages/page-400`));
        await executeMigration(db, 'user', 'token', 'run', 'stop', deps());
    };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(ids));
    assert.equal(moveCalls.length, 1);
    assert.equal(db.records.get(runPath).status, 'stopped');
    assert.equal(db.records.get(runPath).totalCount, 401);
});

test('all databases are counted before the first move, including saved successes', async () => {
    const db = fixture([['done', 'complete']]);
    const queried = [];
    const dependencies = {
        entries: [['task', {}], ['folder', {}]],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => {
            queried.push(source);
            return [{ id: source, title: source }];
        }
    };
    onMove = async () => {
        assert.equal(queried.length, 2);
        assert.equal(db.records.get(runPath).totalCount, 3);
        assert.equal(db.records.get(runPath).totalCountReady, true);
    };
    await executeMigration(db, 'user', 'token', 'run', 'resume', dependencies);
    assert.equal(db.records.get(runPath).completedCount, 3);
    assert.equal(moveCalls.length, 2);
});

test('checkbox defaults are excluded on resume, while matching titles and move defaults migrate', async () => {
    const db = fixture([['default', 'pending']]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [
            ['task', { defaultMigration: 'none', defaultProperty: '기본 휴일' }],
            ['folder', { defaultMigration: 'move', defaultProperty: '기본 폴더' }]
        ],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => source.startsWith('task') ? [
            { id: 'default', title: '설날', properties: { '기본 휴일': { type: 'checkbox', checkbox: true } } },
            { id: 'regular', title: '기본 휴일', properties: { '기본 휴일': { type: 'checkbox', checkbox: false } } }
        ] : [{ id: 'folder', title: '기본 폴더', properties: { '기본 폴더': { type: 'checkbox', checkbox: true } } }]
    });
    assert.deepEqual(moveCalls, ['regular', 'folder']);
    assert.equal(db.records.get(`${runPath}/pages/default`).status, 'skipped');
    assert.equal(db.records.get(runPath).totalCount, 2);
    assert.equal(db.records.get(runPath).completedCount, 2);
});

test('failed discovery never publishes a partial total or starts moving pages', async () => {
    const db = fixture([]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['task', {}], ['folder', {}]],
        resolve: async (name, version) => `${name}-${version}`,
        pages: async source => {
            if (source.startsWith('folder')) throw new Error('query failed');
            return [{ id: 'pending', title: 'pending' }];
        }
    });
    assert.deepEqual(moveCalls, []);
    assert.equal(db.records.get(runPath).totalCountReady, false);
    assert.equal(db.records.get(runPath).status, 'error');
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(['pending']));
    assert.equal(db.records.get(runPath).totalCount, 1);
    assert.equal(db.records.get(runPath).completedCount, 1);
});

test('502 failures show Korean guidance and accurate incomplete counts, then clear on resume', async () => {
    const db = fixture([['done', 'complete'], ['first', 'pending'], ['second', 'pending']]);
    const failure = Object.assign(new Error(
        'Request to Notion API failed with status: 502. Cloudflare Ray ID: a3cde9fa39d3ead9-DFW.'
    ), { status: 502, code: 'notionhq_client_response_error' });
    onMove = async () => { throw failure; };
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());

    const pageResult = db.records.get(`${runPath}/results/page_first`);
    assert.match(pageResult.message, /노션 서버와의 통신에 일시적인 문제/);
    assert.doesNotMatch(pageResult.message, /Request|Cloudflare|Ray ID/);
    assert.equal(db.records.get(`${runPath}/pages/first`).errorMessage, migrationErrorMessage(failure));
    const databaseResult = db.records.get(`${runPath}/results/database_task`);
    assert.equal(databaseResult.incompleteCount, 2);
    assert.equal(databaseResult.message, '데이터베이스 중 2개의 페이지 이전이 완료되지 않았습니다.');
    assert.equal(db.records.get(runPath).completedCount, 1);

    onMove = undefined;
    currentParent = 'source';
    await executeMigration(db, 'user', 'token', 'run', 'resume', deps());
    assert.equal(db.records.get(`${runPath}/results/database_task`).incompleteCount, 0);
    assert.equal(db.records.get(`${runPath}/results/database_task`).message, '데이터베이스 이전 완료');
    assert.equal(db.records.get(`${runPath}/pages/first`).errorMessage, undefined);
    assert.equal(db.records.get(runPath).completedCount, 3);
    assert.equal(db.records.get(runPath).success, true);
});

test('developer errors are replaced with Korean guidance, including unknown and mixed-language errors', () => {
    for (const error of [
        { status: 429 }, { status: 401 }, { status: 403 }, { status: 404 },
        { status: 400 }, { code: 'notionhq_client_request_timeout' },
        new Error('Internal failure'), new Error('오류: internal SDK diagnostics'), null
    ]) {
        const message = migrationErrorMessage(error);
        assert.match(message, /[가-힣]/);
        assert.doesNotMatch(message, /Internal|internal|SDK|diagnostics/);
    }
    assert.equal(migrationErrorMessage(new MigrationConflict('이미 진행 중입니다.')), '이미 진행 중입니다.');
});

test('a validation error is a warning and counts as complete after the page leaves the source', async () => {
    const db = fixture([['moved', 'pending']]);
    onMove = async () => {
        throw Object.assign(new Error('relation property could not be validated'), {
            status: 400, code: 'validation_error'
        });
    };

    await executeMigration(db, 'user', 'token', 'run', 'resume', deps(['moved']));

    assert.equal(db.records.get(`${runPath}/pages/moved`).status, 'complete');
    assert.equal(db.records.get(`${runPath}/pages/moved`).completedWithWarning, true);
    assert.equal(db.records.get(`${runPath}/results/page_moved`).status, 'warning');
    assert.equal(db.records.get(runPath).completedCount, 1);
    assert.equal(db.records.get(runPath).success, true);
});

test('replace archives only a matching target template default', async () => {
    const db = fixture([]);
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['category', { defaultMigration: 'replace', defaultProperty: '기본 태그' }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async source => source === 'source'
            ? [{ id: 'old-default', title: '독서', properties: { '기본 태그': { type: 'checkbox', checkbox: true } } }]
            : [
                { id: 'template-default', title: '독서', properties: { '기본 태그': { type: 'checkbox', checkbox: true } } },
                { id: 'user-page', title: '독서', properties: { '기본 태그': { type: 'checkbox', checkbox: false } } }
            ]
    });

    assert.deepEqual(updateCalls, [{ page_id: 'template-default', archived: true }]);
    assert.deepEqual(moveCalls, ['old-default']);
});

test('template databases verify the new parent and replace old blocks with the default template', async () => {
    const db = fixture([['project-page', 'pending']]);
    db.records.set(`${runPath}/pages/project-page`, {
        ...db.records.get(`${runPath}/pages/project-page`), dbName: 'project'
    });
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['project', { refreshContentWithDefaultTemplate: true }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'project-page', title: '프로젝트' }]
    });

    assert.deepEqual(moveCalls, ['project-page']);
    assert.deepEqual(retrieveCalls, ['project-page']);
    assert.deepEqual(updateCalls, [{
        page_id: 'project-page',
        erase_content: true,
        template: { type: 'default' }
    }]);
    const page = db.records.get(`${runPath}/pages/project-page`);
    assert.equal(page.status, 'complete');
    assert.equal(page.templateApplied, true);
    assert.equal(page.templateApplying, undefined);
});

test('a marked text block and its callout are restored only after the template replaces old blocks', async () => {
    const db = fixture([['project-page', 'pending']]);
    db.records.set(`${runPath}/pages/project-page`, {
        ...db.records.get(`${runPath}/pages/project-page`), dbName: 'project'
    });
    let templateApplied = false;
    onListBlocks = async blockId => ({
        results: blockId === 'old-callout' ? [
            { id: 'old-bullet', type: 'bulleted_list_item', has_children: true, bulleted_list_item: { rich_text: [{ plain_text: '호치민' }] } }
        ] : blockId === 'old-bullet' ? [
            { id: 'old-nested-bullet', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: '맛집' }] } }
        ] : blockId === 'new-callout' ? [] : templateApplied ? [
            { id: 'new-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ 세부 목표' }] } },
            { id: 'new-callout', type: 'callout', callout: { rich_text: [{ plain_text: '기본 내용' }] } }
        ] : [
            { id: 'old-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ 세부 목표' }] } },
            { id: 'old-callout', type: 'callout', has_children: true, callout: { icon: null, rich_text: [{ plain_text: '베트남 1차 여행\n호치민\n1개월' }] } }
        ],
        has_more: false
    });
    onUpdate = async options => { if (options.template) templateApplied = true; };

    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['project', { refreshContentWithDefaultTemplate: true, restoreTemplateContent: true }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'project-page', title: '프로젝트' }]
    });

    assert.deepEqual(updateCalls.at(-1), {
        block_id: 'new-callout',
        callout: { rich_text: [{ plain_text: '베트남 1차 여행\n호치민\n1개월' }] }
    });
    assert.deepEqual(appendCalls, [{
        block_id: 'new-callout',
        children: [{
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: [{ plain_text: '호치민' }] }
        }]
    }, {
        block_id: 'appended-1',
        children: [{
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: [{ plain_text: '맛집' }] }
        }]
    }]);
    assert.deepEqual(deleteCalls, []);
});

test('a matching section retains new template content when old content was intentionally deleted', async () => {
    const db = fixture([['project-page', 'pending']]);
    db.records.set(`${runPath}/pages/project-page`, {
        ...db.records.get(`${runPath}/pages/project-page`), dbName: 'project'
    });
    let templateApplied = false;
    onListBlocks = async blockId => ({
        results: blockId === 'new-callout' ? [
            { id: 'new-default-child', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'new default' }] } }
        ] : templateApplied ? [
            { id: 'new-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ section' }] } },
            { id: 'new-callout', type: 'callout', has_children: true, callout: { rich_text: [] } }
        ] : [
            { id: 'old-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ section' }] } },
            // The user intentionally removed every child from this old section.
            { id: 'old-callout', type: 'callout', has_children: false, callout: { rich_text: [] } }
        ],
        has_more: false
    });
    onUpdate = async options => { if (options.template) templateApplied = true; };

    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['project', { refreshContentWithDefaultTemplate: true, restoreTemplateContent: true }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'project-page', title: 'project-page' }]
    });

    assert.deepEqual(deleteCalls, []);
    assert.deepEqual(appendCalls, []);
});

test('child databases and unsupported blocks are omitted while the new template is applied', async () => {
    const db = fixture([['folder-page', 'pending']]);
    db.records.set(`${runPath}/pages/folder-page`, {
        ...db.records.get(`${runPath}/pages/folder-page`), dbName: 'folder'
    });
    let templateApplied = false;
    onListBlocks = async blockId => ({
        results: blockId === 'old-callout' ? [
            { id: 'child-db', type: 'child_database', child_database: { title: '여행 기록' } },
            { id: 'button', type: 'unsupported', unsupported: { block_type: 'button' } }
        ] : templateApplied ? [
            { id: 'new-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '기본 템플릿' }] } }
        ] : [
            { id: 'old-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ 세부 목표' }] } },
            { id: 'old-callout', type: 'callout', has_children: true, callout: { rich_text: [] } }
        ],
        has_more: false
    });
    onUpdate = async options => { if (options.template) templateApplied = true; };

    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [['folder', { refreshContentWithDefaultTemplate: true, restoreTemplateContent: true }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'folder-page', title: 'folder-page' }]
    });

    assert.equal(db.records.get(`${runPath}/pages/folder-page`).status, 'complete');
    assert.equal(db.records.get(`${runPath}/pages/folder-page`).templateApplied, true);
    assert.equal(db.records.get(`${runPath}/results/page_folder-page`).status, 'ok');
    assert.equal(updateCalls.some(call => call.template), true);
});

for (const policy of [
    { name: 'category does not restore old sections by default', dbName: 'category', options: {} },
    { name: 'project excludes configured sections before reading children', dbName: 'project', options: { restoreTemplateContent: true, excludedTemplateSections: ['노트'] } }
]) test(policy.name, async () => {
    const db = fixture([['policy-page', 'pending']]);
    db.records.set(`${runPath}/pages/policy-page`, {
        ...db.records.get(`${runPath}/pages/policy-page`), dbName: policy.dbName
    });
    let applied = false;
    onListBlocks = async blockId => {
        assert.notEqual(blockId, 'old-callout', 'excluded content must not be read or restored');
        return { results: applied ? [] : [
            { id: 'old-title', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '▫ 노트' }] } },
            { id: 'old-callout', type: 'callout', has_children: true, callout: { rich_text: [] } }
        ], has_more: false };
    };
    onUpdate = async options => { if (options.template) applied = true; };
    await executeMigration(db, 'user', 'token', 'run', 'resume', {
        entries: [[policy.dbName, { refreshContentWithDefaultTemplate: true, ...policy.options }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'policy-page', title: 'policy' }]
    });
    assert.equal(applied, true);
    assert.deepEqual(appendCalls, []);
    assert.deepEqual(deleteCalls, []);
    assert.equal(db.records.get(`${runPath}/pages/policy-page`).status, 'complete');
});

test('resume retries only an incomplete template refresh without moving or recounting the page', async () => {
    const db = fixture([['project-page', 'pending']]);
    db.records.set(`${runPath}/pages/project-page`, {
        ...db.records.get(`${runPath}/pages/project-page`), dbName: 'project'
    });
    const dependencies = {
        entries: [['project', { refreshContentWithDefaultTemplate: true }]],
        resolve: async (_, version) => version === '1.3' ? 'source' : 'target',
        pages: async () => [{ id: 'project-page', title: '프로젝트' }]
    };
    onUpdate = async () => { throw Object.assign(new Error('temporary failure'), { status: 502 }); };
    await executeMigration(db, 'user', 'token', 'run', 'resume', dependencies);
    assert.equal(db.records.get(`${runPath}/pages/project-page`).status, 'error');
    assert.deepEqual(moveCalls, ['project-page']);
    assert.equal(db.records.get(runPath).completedCount, 0);

    onUpdate = undefined;
    await executeMigration(db, 'user', 'token', 'run', 'resume', dependencies);
    assert.deepEqual(moveCalls, ['project-page']);
    assert.equal(updateCalls.length, 2);
    assert.equal(db.records.get(`${runPath}/pages/project-page`).templateApplied, true);
    assert.equal(db.records.get(runPath).completedCount, 1);
});
