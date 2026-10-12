const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeProductSales } = require('../lib/sales-summary');
const { storeVisitDayWindows } = require('../lib/sales-summary');

test('daily inflow windows use KST midnight and retain yesterday across month boundaries', () => {
    const windows = storeVisitDayWindows(Date.parse('2026-11-01T01:00:00Z'));
    assert.equal(new Date(windows[0].start).toISOString(), '2026-10-31T15:00:00.000Z');
    assert.equal(new Date(windows[1].start).toISOString(), '2026-10-30T15:00:00.000Z');
    assert.equal(new Date(windows[2].start).toISOString(), '2026-10-29T15:00:00.000Z');
    assert.equal(windows[1].end, windows[0].start);
    assert.equal(windows[2].end, windows[1].start);
});
test('counts production two-digit purchase dates from CSV, webhook and manual records', () => {
    const rows = ['26.10.03 19:51', '26.10.04 10:14', '26.10.01 14:01', '26.10.08 03:22', '26.10.01 15:00'].map(purchasedAt => ({
        purchasedAt, amount: '79,000원', purchaseOption: '라이프업  1.5  올인원 -  얼리버드  특별 할인 판매'
    }));
    rows.push({ purchasedAt: '26.10.07 17:18', amount: '54,400원', purchaseOption: '라이프업' });
    rows.push({ purchasedAt: '26.09.23 20:13', amount: '10,000원', purchaseOption: '라이프업' });
    assert.deepEqual(summarizeProductSales(rows, '2026-10'), { lifeup: { count: 6, revenue: 449400 } });
});
test('classifies overlapping options, amount boundary and month formats', () => {
    const row = (purchaseOption, amount, purchasedAt = '2026. 10. 11.') => ({ purchaseOption, amount, purchasedAt });
    assert.deepEqual(summarizeProductSales([
        row('라이프업 보상 타임세일', '64,000원'), row('라이프업 보상', 69000),
        row('라이프업', '1,000원'), row('라이프업', 999), row('라이프업', -1000),
        row('라이프업', 'invalid'), row('다른 상품', 79000), row('라이프업', 79000, '2026. 9. 1.'),
        row('라이프업', 79000, '2026-10-01'),
        { ...row('라이프업', 79000), paymentAmount: 0 },
        { ...row('라이프업', 79000), source: 'imweb' }
    ], '2026-10'), {
        'lifeup-reward-sale': { count: 1, revenue: 64000 },
        'lifeup-reward': { count: 1, revenue: 69000 },
        lifeup: { count: 2, revenue: 80000 },
        'lifeup-imweb': { count: 1, revenue: 79000 }
    });
});
