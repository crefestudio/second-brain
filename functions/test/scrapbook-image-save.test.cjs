const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const blocksStart = source.indexOf('        const entityBlocks = this.buildContentBlocks(entity);');
const blocksEnd = source.indexOf('        ////////////////////////////////////////////////////', blocksStart);
const pendingStart = source.lastIndexOf("        if (TEMPLATE_PRODUCTS[workspaceTemplate(userDoc.data() || {})].kakaoCaptureScope === 'reference' &&");
const pendingEnd = source.indexOf('        const payload: any = {', pendingStart);
const image = { object: 'block', type: 'image', image: { type: 'external', external: { url: 'https://example.test/photo.png' } } };
const paragraph = text => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } });

// Execute the production block selection used by Notion page creation.
function blocks(confirmed, entityBlocks, confirmedFlag = 'scrapbookConfirmed') {
    const context = {
        entity: { type: 'image' }, aiResult: { [confirmedFlag]: confirmed, content: 'Converted memo' },
        buildContentBlocks: () => entityBlocks,
        buildTextBlocks: content => [paragraph(content)],
        buildAiContentBlocks: content => [paragraph(content)]
    };
    return vm.runInNewContext(ts.transpile(source.slice(blocksStart, blocksEnd) + '\ncontentBlocks;'), context);
}

test('confirming a photo memo retains the image and converted text without duplicate OCR', () => {
    const result = blocks(true, [image, paragraph('Original OCR')]);
    assert.equal(result.length, 2);
    assert.equal(result[0], image);
    assert.equal(result[1].paragraph.rich_text[0].text.content, 'Converted memo');
});

test('confirmation preserves text-only notes and ordinary photo saves retain all entity blocks', () => {
    assert.equal(blocks(true, [])[0].paragraph.rich_text[0].text.content, 'Converted memo');
    const original = [image, paragraph('Original OCR')];
    assert.equal(blocks(false, original), original);
});

test('file attachments survive every confirmation and note conversion', () => {
    const file = { object: 'block', type: 'file', file: { type: 'external', external: { url: 'https://example.test/report.pdf' }, name: 'report.pdf' } };
    for (const flag of ['scrapbookConfirmed', 'plannerConfirmed', 'memoConfirmed', 'noteCapture']) {
        assert.equal(blocks(true, [file], flag)[0], file);
    }
});

test('Memo confirmation uses the same content builder and image preservation as Scrapbook', () => {
    for (const entityBlocks of [[], [image, paragraph('Original OCR')]]) {
        assert.equal(JSON.stringify(blocks(true, entityBlocks, 'memoConfirmed')),
            JSON.stringify(blocks(true, entityBlocks, 'scrapbookConfirmed')));
    }
});

test('Memo preserves normal AI memo create/correct data and never invokes forced note conversion', () => {
    for (const action of ['create', 'correct']) {
        const enrichedResult = { action, db: 'memo', title: 'Idea', content: 'Body', tags: ['tag'], type: 'idea', response: 'Original response' };
        const expected = JSON.stringify(enrichedResult);
        vm.runInNewContext(ts.transpile(source.slice(pendingStart, pendingEnd)), {
            enrichedResult, captureTemplate: 'lifeUpMemo', workspaceTemplate: () => 'lifeUpMemo', userDoc: { data: () => ({}) },
            TEMPLATE_PRODUCTS: require('../lib/template-catalog').TEMPLATE_PRODUCTS,
            toNoteCapture: () => { throw new Error('Memo must not force note conversion'); }
        });
        assert.equal(JSON.stringify(enrichedResult), expected);
    }
});

function classify(db, template = 'lifeUpScrapbook') {
    const enrichedResult = { action: 'create', db, response: 'Original response' };
    vm.runInNewContext(ts.transpile(source.slice(pendingStart, pendingEnd)), {
        enrichedResult, captureTemplate: template, workspaceTemplate: () => template, userDoc: { data: () => ({}) },
        TEMPLATE_PRODUCTS: require('../lib/template-catalog').TEMPLATE_PRODUCTS
    });
    return enrichedResult;
}

test('Notion write boundary rejects every unsupported destination for limited templates', () => {
    const start = source.indexOf("        if (TEMPLATE_PRODUCTS[workspaceTemplate(userDoc.data() || {})].kakaoCaptureScope === 'reference' && aiResult.db");
    const end = source.indexOf('        const notion = guardedNotionClient', start);
    const code = ts.transpile(source.slice(start, end));
    for (const template of ['lifeUp', 'lifeUpScrapbook', 'lifeupPlanner', 'lifeupPlannerLite', 'lifeUpMemo']) {
        for (const db of ['task', 'reference', 'memo', 'project', 'contact', 'book', 'note']) {
            const run = () => vm.runInNewContext(code, { workspaceTemplate: () => template,
                userDoc: { data: () => ({}) }, aiResult: { db }, TEMPLATE_PRODUCTS: require('../lib/template-catalog').TEMPLATE_PRODUCTS });
            const allowed = template === 'lifeUp' || db === (template === 'lifeUpScrapbook' ? 'reference' : template === 'lifeUpMemo' ? 'memo' : 'task');
            if (allowed) assert.doesNotThrow(run); else assert.throws(run, /_ONLY/);
        }
    }
});

test('a photo classified as memo is reported as memo, not as a task', () => {
    const result = classify('memo');
    assert.equal(result.db, 'memo');
    assert.equal(result.action, 'scrapbookPending');
    assert.match(result.response, /분류 결과: 메모/);
    assert.doesNotMatch(result.response, /할 일로 분류/);
});

test('other destinations retain correct labels and supported saves do not become pending', () => {
    for (const [db, label] of [['task', '할 일'], ['project', '프로젝트'], ['contact', '연락처']]) {
        assert.ok(classify(db).response.startsWith(`분류 결과: ${label}`));
    }
    assert.equal(classify('reference').action, 'create');
    assert.equal(classify('memo', 'lifeUp').action, 'create');
});

test('Planner asks before non-task saves while task saves proceed', () => {
    for (const template of ['lifeupPlanner', 'lifeupPlannerLite']) {
    for (const db of ['reference', 'memo', 'contact']) {
        const result = classify(db, template);
        assert.equal(result.action, 'plannerPending');
        assert.equal(result.plannerPending, true);
        assert.match(result.response, /할 일로 저장할까요/);
    }
    assert.equal(classify('task', template).action, 'create');
    }
});

test('Planner Lite confirms only task saves and uses its own upgrade link', async () => {
    assert.match(classify('project', 'lifeupPlannerLite').response, /upgrade\/lifeup-planner-lite\?/);
    const { saves } = await confirm('lifeupPlannerLite', { db: 'project', plannerPending: true, content: 'test' });
    assert.equal(saves.length, 1);
    assert.equal(saves[0].db, 'task');
});

async function confirm(templateId, result) {
    const start = source.indexOf('        const captureTemplate = workspaceTemplate(');
    const end = source.indexOf('        console.log("[KAKAO] processAssistantEntity START"', start);
    const saves = [], replies = [], updates = [];
    const ref = { collection: () => ref, doc: () => ref, update: async value => updates.push(value) };
    const context = {
        workspaceTemplate: () => templateId, userDoc: { data: () => ({}) }, userMessage: '저장', userId: 'u', callbackUrl: 'callback', pageUrls: {},
        TEMPLATE_PRODUCTS: require('../lib/template-catalog').TEMPLATE_PRODUCTS,
        getLastAssistantContext: async () => ({ result, userMessage: 'original text', entity: {}, contextId: 'ctx' }),
        reply: async text => replies.push(text), guard: async () => {},
        NotionService: { createDbItemFromAiResult: async (_uid, value) => { saves.push(value); return 'page'; } },
        buildAssistantResponse: value => value.response, removeUndefined: value => value,
        fallbackCaptureTitle: require('../lib/template-capture').fallbackCaptureTitle,
        db: ref, logger: { error() {} }
    };
    await vm.runInNewContext(ts.transpile('(async () => {' + source.slice(start, end) + '})()'), context);
    return { saves, replies, updates };
}

test('Memo saves memos directly and confirms other classifications into memo only', async () => {
    assert.equal(classify('memo', 'lifeUpMemo').action, 'create');
    for (const db of ['task', 'reference', 'contact', 'note']) {
        const pending = classify(db, 'lifeUpMemo');
        assert.equal(pending.action, 'memoPending');
        assert.equal(pending.memoPending, true);
        assert.match(pending.response, /메모로 저장할까요/);
        assert.match(pending.response, /upgrade\/lifeup-memo\?/);
        const { saves, updates } = await confirm('lifeUpMemo', { ...pending, content: 'Details' });
        assert.equal(saves.length, 1);
        assert.equal(saves[0].db, 'memo');
        assert.equal(saves[0].memoConfirmed, true);
        assert.equal(saves[0].memoPending, false);
        assert.match(saves[0].content, /Details/);
        assert.equal(updates[0].pageId, 'page');
    }
    for (const result of [{ memoPending: false }, { plannerPending: true }, { scrapbookPending: true }]) {
        assert.equal((await confirm('lifeUpMemo', result)).saves.length, 0);
    }
});

test('Planner confirmation writes task and consumes pending status', async () => {
    const { saves, updates } = await confirm('lifeupPlanner', { db: 'reference', plannerPending: true, title: 'Title', content: 'Details' });
    assert.equal(saves.length, 1);
    assert.equal(saves[0].db, 'task');
    assert.equal(saves[0].action, 'create');
    assert.equal(saves[0].kinds, '수집함');
    assert.equal(saves[0].plannerPending, false);
    assert.match(saves[0].content, /original text/);
    assert.match(saves[0].content, /Details/);
    assert.equal(updates[0].pageId, 'page');
});

test('confirmation preserves scrapbook destination and rejects consumed or mismatched pending state', async () => {
    assert.equal((await confirm('lifeUpScrapbook', { db: 'memo', scrapbookPending: true })).saves[0].db, 'reference');
    for (const result of [{ plannerPending: false }, { scrapbookPending: true }]) {
        assert.equal((await confirm('lifeupPlanner', result)).saves.length, 0);
    }
});
