const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CustomerListPage, customerListOptions } = require('../lib/customer-list-page');
const rows = Array.from({length: 251}, (_, i) => ({id: String(i).padStart(4, '0'), name: `고객${i}`, phone: `010${i}`, purchasedAt: '2026.09.30', memberType: i >= 150 ? 'premium' : 'standard', membership: 'standard', notificationConsent: '예'}));
function page(options = {}, cursor) {
    const result = new CustomerListPage(customerListOptions(options), cursor);
    rows.forEach(row => result.add(row));
    return result.result();
}
test('all pages have stable boundaries with equal sort values', () => {
    const a = page(); const b = page({}, a.nextCursor); const c = page({}, b.nextCursor);
    assert.deepEqual([a.customers.length, b.customers.length, c.customers.length], [100,100,51]);
    assert.equal(new Set([...a.customers,...b.customers,...c.customers].map(row => row.id)).size, 251);
    assert.equal(c.nextCursor, null); assert.equal(a.totalCount, 251);
});
test('filters find customers beyond the original first 100 and count all matches', () => {
    const result = page({memberFilter:'premium', membershipFilter:'standard', notifyFilter:'yes'});
    assert.equal(result.filteredCount, 101); assert.equal(result.totalCount, 251);
    assert.equal(result.customers[0].id, '0150');
    assert.equal(page({search:'고객250'}).customers[0].id, '0250');
    assert.equal(page({notifyFilter:'blocked'}).filteredCount, 0);
});
test('sorting applies globally before pagination', () => {
    const expected = [...rows].sort((a,b) => b.name.localeCompare(a.name,'ko') || a.id.localeCompare(b.id));
    assert.deepEqual(page({sort:'name'}).customers.map(r=>r.id), expected.slice(0,100).map(r=>r.id));
});
test('cursor cannot be reused for a different filter', () => {
    assert.throws(() => page({memberFilter:'premium'}, page().nextCursor), /INVALID_CUSTOMER_CURSOR/);
    assert.throws(() => page({}, 'bad'), /INVALID_CUSTOMER_CURSOR/);
    assert.throws(() => page({sort:'unknown'}), /INVALID_CUSTOMER_QUERY/);
});
