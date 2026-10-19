const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fallbackCaptureTitle, toNoteCapture } = require('../lib/template-capture');
const { TEMPLATE_PRODUCTS, canUseAgent } = require('../lib/template-catalog');

test('Second Brain OS routes all four AI classifications to notes without losing their meaning', () => {
    for (const [db, label] of Object.entries({ task: '할일', memo: '메모', reference: '자료', contact: '연락처' })) {
        const input = { action: 'create', db, title: '테스트', content: '분석된 내용', project: '프로젝트', folder: '폴더' };
        const result = toNoteCapture(input, { phone: '010-0000-0000' }, '사용자 원문');
        assert.equal(input.db, db);
        assert.equal(result.db, 'note');
        assert.equal(result.sourceDb, db);
        assert.equal(result.title, `[${label}] 테스트`);
        assert.ok(result.content.includes('분석된 내용'));
        assert.ok(result.content.includes('사용자 원문'));
        if (db === 'contact') assert.ok(result.content.includes('010-0000-0000'));
        assert.equal(result.project, undefined);
        assert.equal(result.folder, undefined);
    }
});
test('fallback prefix is not duplicated and supported content remains unchanged', () => {
    assert.equal(fallbackCaptureTitle('[자료] 링크', 'reference'), '[자료] 링크');
    assert.equal(fallbackCaptureTitle('노트', 'note'), '노트');
});
test('Second Brain OS has its own sales destination and appropriate permissions', () => {
    const p = TEMPLATE_PRODUCTS.lifeUpSecondBrainOS;
    assert.equal(p.checkoutUrls.normal, 'https://notionable.net/store/?idx=14');
    assert.equal(p.kakaoCaptureScope, 'note');
    assert.equal(canUseAgent('lifeUpSecondBrainOS', 'routine'), false);
    assert.equal(canUseAgent('lifeUpSecondBrainOS', 'secondbrain'), true);
});
