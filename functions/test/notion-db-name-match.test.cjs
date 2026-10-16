const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const start = source.indexOf('    static async getDatabaseIdByDatabaseName(');
const method = source.slice(start, source.indexOf('    // queryDatabase', start));
function resolver(titles) {
    const context = { console: { log() {} }, fetch: async () => ({ ok: true, text: async () => JSON.stringify({
        results: titles.map((title, i) => typeof title === 'string' ? ({ id: String(i), title: [{ plain_text: title }] }) : ({ id: String(i), ...title })), has_more: false
    }) }) };
    vm.createContext(context);
    vm.runInContext(ts.transpile(`class Resolver { ${method} } globalThis.Resolver = Resolver;`, { target: ts.ScriptTarget.ES2020 }), context);
    return context.Resolver;
}
test('slash names resolve using base keyword and respect version', async () => {
    const r = resolver(['lifeup info / 15 / Scrapbook']);
    assert.equal(await r.getDatabaseIdByDatabaseName('token', 'lifeup info'), '0');
    assert.equal(await r.getDatabaseIdByDatabaseName('token', 'lifeup info', '1.5'), '0');
    await assert.rejects(r.getDatabaseIdByDatabaseName('token', 'lifeup info', '1.3'));
});
test('legacy names still match without confusing reference with reference tag', async () => {
    const r = resolver(['reference #15', 'reference tag / 15 / Scrapbook']);
    assert.equal(await r.getDatabaseIdByDatabaseName('token', 'reference'), '0');
});
test('duplicate slash names produce terminal code and exact count', async () => {
    const r = resolver(['lifeup info / 15 / Scrapbook', 'lifeup info / 15 / ScrapBook']);
    await assert.rejects(r.getDatabaseIdByDatabaseName('token', 'lifeup info'), error =>
        error.code === 'DUPLICATE_DATABASE' && error.message === 'lifeup info DB의 결과가 2개 나와서 연결이 거절되었습니다.');
});
test('archived or trashed DBs do not cause duplicates', async () => {
    for (const flag of ['archived', 'in_trash']) {
        const r = resolver(['reference / 15 / Scrapbook', { title: [{ plain_text: 'reference #15' }], [flag]: true }]);
        assert.equal(await r.getDatabaseIdByDatabaseName('token', 'reference'), '0');
    }
});
test('only trashed results produce an explicit unavailable message', async () => {
    const r = resolver([{ title: [{ plain_text: 'reference #15' }], archived: true, in_trash: true }]);
    await assert.rejects(r.getDatabaseIdByDatabaseName('token', 'reference'), /모두 휴지통/);
});
test('Scrapbook scope excludes legacy and other templates but accepts any version', async () => {
    const r = resolver(['reference #15', 'reference / 15 / Lifeup', 'reference / 20 / Scrapbook']);
    assert.equal(await r.getDatabaseIdByDatabaseName('token', 'reference', undefined, 'lifeUpScrapbook'), '2');
});
test('Scrapbook scope accepts mixed separators and ignores whitespace and case', async () => {
    for (const title of [' Reference Tag # 2.0 / ScrapBook ', 'REFERENCE TAG / 16 # SCRAPBOOK', 'reference tag#next#scrapbook']) {
        assert.equal(await resolver([title]).getDatabaseIdByDatabaseName('token', 'reference tag', undefined, 'lifeUpScrapbook'), '0');
    }
});
test('Scrapbook scope never falls back to legacy DB and still rejects duplicates', async () => {
    await assert.rejects(resolver(['reference #15']).getDatabaseIdByDatabaseName('token', 'reference', undefined, 'lifeUpScrapbook'));
    const r = resolver(['reference / 15 / Scrapbook', 'reference / 15 / ScrapBook']);
    await assert.rejects(r.getDatabaseIdByDatabaseName('token', 'reference', undefined, 'lifeUpScrapbook'), error => error.code === 'DUPLICATE_DATABASE');
});

test('Planner uses the actual Panner suffix and excludes other templates', async () => {
    const r = resolver(['lifeup info #15', 'lifeup info / 15 / Scrapbook', 'lifeup info / 15 / Panner', 'lifeup info / 15 / Planner']);
    assert.equal(await r.getDatabaseIdByDatabaseName('token', 'lifeup info', undefined, 'lifeupPlanner'), '2');
    assert.equal(await resolver(['task / 15 / Panner', 'task / 15 / Scrapbook']).getDatabaseIdByDatabaseName('token', 'task', undefined, 'lifeupPlanner'), '0');
});

test('Planner does not fall back and duplicate Panner databases fail', async () => {
    await assert.rejects(resolver(['lifeup info #15', 'lifeup info / 15 / Planner']).getDatabaseIdByDatabaseName('token', 'lifeup info', undefined, 'lifeupPlanner'));
    await assert.rejects(resolver(['lifeup info / 15 / Panner', 'lifeup info / 15 / PANNER']).getDatabaseIdByDatabaseName('token', 'lifeup info', undefined, 'lifeupPlanner'), error => error.code === 'DUPLICATE_DATABASE');
});

test('Planner discovery preserves version-independent matching', async () => {
    for (const title of ['lifeup info / 15 / Panner', 'lifeup info / 20 / Panner', 'habit log # next / Panner']) {
        const name = title.startsWith('habit') ? 'habit log' : 'lifeup info';
        assert.equal(await resolver([title]).getDatabaseIdByDatabaseName('token', name, undefined, 'lifeupPlanner'), '0');
    }
});
