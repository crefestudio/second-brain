const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function methodFrom(file, className, methodName) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  let subject;
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name?.text === className) subject = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === className && ts.isClassExpression(node.initializer)) subject = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const method = subject.members.find(node => node.name?.getText(tree) === methodName);
  return ts.transpileModule(`class Subject { ${method.getText(tree)} } globalThis.Subject = Subject;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 }
  }).outputText;
}

test('update reload keeps the current deep link, query and fragment without activating in place', () => {
  const code = methodFrom('src/app/app.component.ts', 'AppComponent', 'reloadWithLatestApp');
  for (const url of ['https://app.notionable.net/gift/lifeupfree', 'https://app.notionable.net/gift/lifeupfree?from=youtube#form', 'https://app.notionable.net/workspace/home?templateId=lifeUp']) {
    const reloads = [];
    const location = { href: url, reload() { reloads.push(this.href); } };
    const context = vm.createContext({ window: { location } });
    vm.runInContext(code, context);
    const app = new context.Subject();
    app.swUpdate = { activateUpdate() { assert.fail('Must reload instead of activating old shell in place'); } };
    app.reloadWithLatestApp();
    assert.deepEqual(reloads, [url]);
    assert.equal(location.href, url);
  }
});

// Exercise the installed Angular worker's real navigation handler with cached
// and current app shells, without requiring a signed-in browser or a deployment.
function worker(strategy, offline = false) {
  const context = vm.createContext({});
  vm.runInContext(methodFrom('node_modules/@angular/service-worker/ngsw-worker.js', 'AppVersion', 'handleFetch'), context);
  const version = new context.Subject();
  version.assetGroups = [{ handleFetch: async req => req.url === '/index.html' ? 'old cached app' : null }];
  version.dataGroups = [];
  version.indexUrl = '/index.html';
  version.adapter = { normalizeUrl: url => url, newRequest: url => ({ url }) };
  version.isNavigationRequest = () => true;
  version.manifest = { navigationRequestStrategy: strategy };
  version.scope = { fetch: async req => {
    if (offline) throw Error('offline');
    return { shell: 'current app', url: req.url };
  } };
  return version;
}

test('deployed navigation strategy loads current routes instead of an old cached shell', async () => {
  const request = { url: 'https://app.notionable.net/gift/lifeupfree?from=youtube' };
  assert.equal(await worker('performance').handleFetch(request, {}), 'old cached app');
  const config = JSON.parse(read('ngsw-config.json'));
  const response = await worker(config.navigationRequestStrategy).handleFetch(request, {});
  assert.equal(response.shell, 'current app');
  assert.equal(response.url, request.url);
});

test('navigation still falls back to cached app when offline', async () => {
  const config = JSON.parse(read('ngsw-config.json'));
  assert.equal(await worker(config.navigationRequestStrategy, true).handleFetch({ url: '/gift/lifeupfree' }, {}), 'old cached app');
});
