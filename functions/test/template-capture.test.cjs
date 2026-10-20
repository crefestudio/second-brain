const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fallbackCaptureTitle, toNoteCapture } = require('../lib/template-capture');
const { TEMPLATE_PRODUCTS, canUseAgent } = require('../lib/template-catalog');

test('Second Brain OS converts supported AI classifications to notes with spaced labels', () => {
    const labels = { task: '\uD560\uC77C', memo: '\uBA54\uBAA8', reference: '\uC790\uB8CC', contact: '\uC5F0\uB77D\uCC98' };
    for (const [db, label] of Object.entries(labels)) {
        const input = { action: 'create', db, title: 'test title', content: 'classified content', project: 'project', folder: 'folder' };
        const result = toNoteCapture(input, { phone: '010-0000-0000' }, 'user message');
        assert.equal(input.db, db);
        assert.equal(result.db, 'note');
        assert.equal(result.sourceDb, db);
        assert.equal(result.title, `[ ${label} ] test title`);
        assert.ok(result.content.includes('classified content'));
        assert.ok(result.content.includes('user message'));
        if (db === 'contact') assert.ok(result.content.includes('010-0000-0000'));
        assert.equal(result.project, undefined);
        assert.equal(result.folder, undefined);
    }
});

test('legacy labels are not duplicated and unsupported sources are unchanged', () => {
    assert.equal(fallbackCaptureTitle('[\uC790\uB8CC] bookmark', 'reference'), '[\uC790\uB8CC] bookmark');
    assert.equal(fallbackCaptureTitle('note title', 'note'), 'note title');
});

test('Second Brain OS has its own sales destination and appropriate permissions', () => {
    const p = TEMPLATE_PRODUCTS.lifeUpSecondBrainOS;
    assert.equal(p.checkoutUrls.normal, 'https://notionable.net/store/?idx=14');
    assert.equal(p.kakaoCaptureScope, 'note');
    assert.equal(canUseAgent('lifeUpSecondBrainOS', 'routine'), false);
    assert.equal(canUseAgent('lifeUpSecondBrainOS', 'secondbrain'), true);
    assert.equal(canUseAgent('lifeUpSecondBrainOSLite', 'secondbrain'), false);
    assert.equal(canUseAgent('lifeUpSecondBrainOSLite', 'kakao-capture'), true);
});
