// Pure route/configuration checks: no network, database or account actions.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function navigation(hostname) {
    const window = {location: {hostname}};
    function evaluate(file, dependencies = {}) {
        const exports = {};
        const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
        vm.runInNewContext(code, {exports, window, require: name => dependencies[name] || {}});
        return exports;
    }
    const helpers = evaluate('src/app/config/community-navigation.ts');
    const router = {createUrlTree: (commands, options) => ({commands, ...options})};
    const {routes} = evaluate('src/app/app.routes.ts', {
        './config/community-navigation': helpers,
        './config/template-catalog': {TEMPLATE_IDS: []},
        '@angular/core': {inject: () => router}
    });
    return {helpers, routes};
}

test('community host serves root and preserves old post links, queries and fragments', () => {
    const {helpers, routes} = navigation('club.notionable.net');
    assert.equal(helpers.communityHomePath(), '/');
    const root = routes.find(r => r.path === '' && r.loadComponent);
    assert.ok(root.canMatch.every(match => match()));
    assert.equal(root.title, '노셔너블 클럽');
    const legacy = routes.find(r => r.path === 'club');
    const queryParams = {post: 'post-123', room: 'hello', settings: 'notifications'};
    const target = legacy.redirectTo({queryParams, fragment: 'reply'});
    assert.equal(target.commands[0], '/'); assert.equal(target.queryParams, queryParams); assert.equal(target.fragment, 'reply');
    assert.equal(legacy.redirectTo({queryParams, fragment: null}).fragment, undefined);
    for (const path of ['/', '/?post=p&view=mine', '/club?post=p']) assert.ok(helpers.isCommunityReturnPath(path));
    for (const path of ['//other.example', '/workspace', '/login', 'https://other.example']) assert.equal(helpers.isCommunityReturnPath(path), false);
    assert.equal(routes.find(r => r.path === 'login').title(), '노셔너블 클럽');
});

test('app host retains its workspace root, community path and login title', () => {
    const {helpers, routes} = navigation('app.notionable.net');
    assert.equal(helpers.communityHomePath(), '/club');
    assert.equal(routes.some(r => r.path === 'club' && r.redirectTo), false);
    assert.ok(routes.find(r => r.path === 'club').loadComponent);
    assert.equal(routes.find(r => r.path === '' && r.loadComponent).canMatch[0](), false);
    assert.equal(routes.find(r => r.path === '' && r.redirectTo).redirectTo, 'workspace/home');
    assert.equal(helpers.isCommunityReturnPath('/?post=p'), false);
    assert.equal(routes.find(r => r.path === 'login').title(), '라이프봇');
});

test('initial browser title is scoped to the community domain', () => {
    const html = fs.readFileSync('src/index.html', 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const hostname of ['club.notionable.net', 'app.notionable.net']) {
        const document = {title: '라이프봇'};
        vm.runInNewContext(script, {location: {hostname}, document});
        assert.equal(document.title, hostname.startsWith('club.') ? '노셔너블 클럽' : '라이프봇');
    }
});

test('legacy community links retain post queries and fragments on both hosts', () => {
 for (const hostname of ['club.notionable.net', 'community.notionable.net', 'app.notionable.net']) {
  const {helpers, routes} = navigation(hostname);
  const queryParams = {post: 'existing-post'};
  const result = routes.find(r => r.path === 'community').redirectTo({queryParams, fragment: 'reply'});
  assert.equal(result.commands[0], hostname === 'app.notionable.net' ? '/club' : '/');
  assert.equal(result.queryParams, queryParams);
  assert.equal(result.fragment, 'reply');
  assert.ok(helpers.isCommunityReturnPath('/community?post=existing-post'));
  assert.ok(helpers.isCommunityReturnPath('/club?post=existing-post'));
 }
});
