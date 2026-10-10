const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addCustomerGrade, normalizedCustomerPhone } = require('../lib/customer-grades');
const { CustomerListPage, customerListOptions } = require('../lib/customer-list-page');

test('legacy formatted purchase phones match normalized customer phones', () => {
    for (const phone of ['010-1234-5678', '010 1234 5678', '(010)1234-5678', '01012345678']) {
        const grades = new Map();
        addCustomerGrade(grades, phone, 'standard');
        assert.equal(grades.get(normalizedCustomerPhone('01012345678')), 'standard');
    }
});
test('premium remains highest grade regardless of purchase order', () => {
    const grades = new Map();
    addCustomerGrade(grades, '010-1234-5678', 'standard');
    addCustomerGrade(grades, '01012345678', 'premium');
    addCustomerGrade(grades, '010 1234 5678', 'standard');
    addCustomerGrade(grades, '', 'standard');
    addCustomerGrade(grades, '01099999999', null);
    assert.equal(grades.size, 1);
    assert.equal(grades.get('01012345678'), 'premium');
});
test('scrapbook is retained unless the customer has a LifeUp purchase', () => {
    const grades = new Map();
    addCustomerGrade(grades, '010-1234-5678', 'scrapbook');
    assert.equal(grades.get('01012345678'), 'scrapbook');
    addCustomerGrade(grades, '01012345678', 'standard');
    assert.equal(grades.get('01012345678'), 'standard');
});
test('140 formatted standard purchases remain standard across result pages', () => {
    const grades = new Map();
    const rows = Array.from({length: 140}, (_, i) => {
        const tail = String(i).padStart(4, '0');
        addCustomerGrade(grades, `010-1234-${tail}`, 'standard');
        return {id: tail, phone: `0101234${tail}`};
    });
    const options = customerListOptions({memberFilter: 'standard'});
    const first = new CustomerListPage(options);
    rows.forEach(row => first.add({...row, memberType: grades.get(row.phone)}));
    const result = first.result();
    assert.equal(result.filteredCount, 140);
    assert.equal(result.customers.length, 100);
    const second = new CustomerListPage(options, result.nextCursor);
    rows.forEach(row => second.add({...row, memberType: grades.get(row.phone)}));
    assert.equal(second.result().customers.length, 40);
    assert.equal(second.result().nextCursor, null);
});
