const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const blocksStart = source.indexOf('        const entityBlocks = this.buildContentBlocks(entity);');
const blocksEnd = source.indexOf('        ////////////////////////////////////////////////////', blocksStart);
const pendingStart = source.lastIndexOf("        if (workspaceTemplate(userDoc.data() || {}) === 'lifeUpScrapbook' &&");
const pendingEnd = source.indexOf('        const payload: any = {', pendingStart);
const image = { object: 'block', type: 'image', image: { type: 'external', external: { url: 'https://example.test/photo.png' } } };
const paragraph = text => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } });

// Execute the production block selection used by Notion page creation.
function blocks(confirmed, entityBlocks) {
    const context = {
        entity: { type: 'image' }, aiResult: { scrapbookConfirmed: confirmed, content: 'Converted memo' },
        buildContentBlocks: () => entityBlocks,
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

function classify(db, template = 'lifeUpScrapbook') {
    const enrichedResult = { action: 'create', db, response: 'Original response' };
    vm.runInNewContext(ts.transpile(source.slice(pendingStart, pendingEnd)), {
        enrichedResult, workspaceTemplate: () => template, userDoc: { data: () => ({}) }
    });
    return enrichedResult;
}

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
