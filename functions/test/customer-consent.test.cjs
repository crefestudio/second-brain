const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/index.ts'), 'utf8');

function fixture(preference) {
    const records = [
        { templateId: 'lifeUp', emails: [' MEMBER@EXAMPLE.COM '], notificationConsent: '예' },
        { templateId: 'lifeUp', email: 'member@example.com', notificationConsent: '예' }
    ];
    const refs = records.map(data => ({ data }));
    const snapshot = ref => ({ ref, data: () => ref.data });
    const db = {
        collection: name => name === 'appAccounts' ? { doc: () => ({ data: preference }) } : {
            where: () => ({ get: async () => ({ docs: refs.map(snapshot) }) })
        },
        runTransaction: async callback => callback({
            get: async ref => snapshot(ref),
            set: (ref, data) => Object.assign(ref.data, data)
        })
    };
    const context = vm.createContext({ db, admin: {
        auth: () => ({ getUsers: async () => ({ users: preference ? [{ uid: 'member' }] : [] }) }),
        firestore: { FieldValue: { serverTimestamp: () => 123 } }
    } });
    const helpers = source.slice(source.indexOf('async function memberPreferenceRefs'), source.indexOf('// Customers are a marketing audience.'));
    vm.runInContext(ts.transpile(`function customerEmail(value: unknown): string { return String(value ?? '').trim().toLowerCase(); }\n${helpers}`, { target: ts.ScriptTarget.ES2020 }), context);
    return { records, update: (value, source) => context.setCurrentCustomerConsent('member@example.com', value, source) };
}

test('profile opt-out updates all matching customers including legacy and unnormalized emails', async () => {
    const f = fixture({ marketingConsent: false, marketingConsentSource: 'user' });
    await f.update(false, 'account');
    assert.ok(f.records.every(r => r.notificationConsent === '아니오' && r.notificationConsentSource === 'account'));
});

test('reimport and purchase cannot override explicit profile opt-out even before synchronization', async () => {
    for (const source of ['csv', 'purchase']) {
        const f = fixture({ marketingConsent: false, marketingConsentSource: 'user' });
        await f.update(true, source);
        assert.ok(f.records.every(r => r.notificationConsent === '아니오'));
    }
});

test('explicit opt-in also takes precedence over survey opt-out', async () => {
    const f = fixture({ marketingConsent: true, marketingConsentSource: 'user' });
    await f.update(false, 'csv');
    assert.ok(f.records.every(r => r.notificationConsent === '예'));
});

test('nonmember keeps survey consent', async () => {
    const f = fixture(undefined);
    await f.update(true, 'csv');
    assert.ok(f.records.every(r => r.notificationConsent === '예' && r.notificationConsentSource === 'csv'));
});
