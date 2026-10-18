const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../lib/template-catalog');
const source = fs.readFileSync('src/app/services/scrapbook-upgrade-event.service.ts', 'utf8');
function fixture(ageHours) {
    const context = { exports: {}, require: name => {
        if (name === '@angular/core') return { Injectable: () => target => target };
        if (name === 'rxjs') return { firstValueFrom: value => value };
        if (name.endsWith('/template-catalog')) return catalog;
        if (name.endsWith('/firebase')) return { auth: { currentUser: { getIdToken: async () => 'test' } } };
        return {};
    } };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText, context);
    return new context.exports.ScrapbookUpgradeEventService({ post: async () => ({ firstSeenAt: Date.now() - ageHours * 3600000, serverNow: Date.now() }) });
}
test('planner active and expired offers use pack routes; scrapbook retains single-product offers', async () => {
    for (const [id, prefix] of [['lifeupPlanner', 'lifeup-reward-pack'], ['lifeupPlannerLite', 'lifeup-reward'], ['lifeUpScrapbook', 'lifeup-reward']]) {
        const active = fixture(1);
        await active.initialize('workspace', id);
        assert.equal(active.isActive, true);
        assert.equal(active.upgradeUrl('download'), 'https://app.notionable.net/store/' + prefix + '-sale?from=download');
        const expired = fixture(49);
        await expired.initialize('workspace', id);
        assert.equal(expired.isActive, false);
        assert.equal(expired.upgradeUrl('download'), 'https://app.notionable.net/store/' + prefix + '?from=download');
    }
});
