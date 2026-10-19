const { test } = require('node:test');
const assert = require('node:assert/strict');
const { templateWelcomeMail } = require('../lib/template-welcome-mail');
const { TEMPLATE_PRODUCTS, TEMPLATE_IDS } = require('../lib/template-catalog');
const links = { installYoutubeUrl: 'https://example.com/install', reviewUrl: 'https://example.com/review', lifeupbotUrl: 'https://example.com/bot', lifeupCareUrl: 'https://example.com/care' };

for (const id of TEMPLATE_IDS) {
    test(`${id}: shared layout, product links and conditional sections`, () => {
        const product = TEMPLATE_PRODUCTS[id];
        const mail = templateWelcomeMail(id, '<고객&이름>', links);
        assert.ok(mail.html.includes('&lt;고객&amp;이름&gt;'));
        assert.ok(!mail.html.includes('<고객&이름>'));
        for (const body of [mail.html, mail.text]) {
            assert.ok(body.includes(product.releaseUrl));
            assert.ok(body.includes(product.pdfFileName));
            assert.ok(body.includes(`templateId=${id}`));
            assert.ok(body.includes('라이프봇을 소개합니다'));
            assert.ok(body.includes('라이프봇 둘러보기'));
            assert.ok(body.includes('라이프업 케어'));
            assert.equal(body.includes('짧은 소개 영상으로'), !!product.welcome.introductionVideoUrl);
            assert.equal(body.includes(links.reviewUrl), !!product.welcome.reviewEvent);
        }
        assert.ok(mail.html.includes('<strong>카카오톡 연결</strong>'));
        assert.ok(mail.html.includes(`menu=connect&amp;templateId=${id}`));
        assert.ok(mail.text.includes(`menu=connect&templateId=${id}`));
        if (product.welcome.reviewEvent) {
            assert.ok(mail.text.includes(id === 'lifeUp' ? '(~12/31)' : '(~12/31)'));
        }
    });
}
test('introduction visibility follows URL, not product identity', () => {
    const config = TEMPLATE_PRODUCTS.lifeupPlannerLite.welcome;
    const original = config.introductionVideoUrl;
    try {
        config.introductionVideoUrl = 'https://example.com/lite-video';
        const mail = templateWelcomeMail('lifeupPlannerLite', '', links);
        assert.ok(mail.html.includes(config.introductionVideoUrl));
        assert.ok(mail.text.includes('짧은 소개 영상으로 GTD 플래너 Lite 사용 방법을 확인해 보세요.'));
    } finally { config.introductionVideoUrl = original; }
});
test('LifeUp retains caller supplied installation URL', () => {
    const mail = templateWelcomeMail('lifeUp', '', links, 'https://example.com/release');
    assert.ok(mail.html.includes('https://example.com/release'));
    assert.ok(mail.text.includes('https://example.com/release'));
});
