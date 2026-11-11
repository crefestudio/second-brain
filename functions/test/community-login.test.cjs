const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function compile(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/app', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
  const context = { exports: {}, require: name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, Error, URLSearchParams, ...globals };
  vm.runInNewContext(code, context); return context.exports;
}
test('same Firebase login supports community without requesting a product workspace; app login keeps its session flow', async () => {
  const account = { uid: 'same-uid', email: 'member@example.test', emailVerified: true };
  const firebase = { currentUser: null };
  let sessions = 0, popups = 0;
  const signal = value => { const getter = () => value; getter.set = v => value = v; return getter; };
  class Provider { setCustomParameters() {} addScope() {} }
  const { SocialAuthService } = compile('services/social-auth.service.ts', {
    '@angular/core': { Injectable: () => x => x, inject: () => ({ functionsBaseUrl: 'http://test' }), signal },
    'firebase/auth': { GoogleAuthProvider: Provider, OAuthProvider: Provider,
      signInWithPopup: async () => { popups++; firebase.currentUser = account; },
      signInWithCustomToken: async () => { firebase.currentUser = account; } },
    '../firebase': { auth: firebase }, '../config/app-config.token': { APP_CONFIG: {} }
  });
  const service = new SocialAuthService();
  service.session = async () => { sessions++; return {}; };
  assert.equal(await service.login('google', true), true);
  assert.equal(sessions, 0); assert.equal(firebase.currentUser.uid, 'same-uid');
  assert.equal(await service.login('google'), true);
  assert.equal(sessions, 1); assert.equal(popups, 2);
  firebase.currentUser = null;
  service.init = async () => {}; service.purchaseRequest = async () => ({ token: 'test' });
  assert.equal(await service.loginWithPurchase('member@example.test', '123456', 'lifeUp', true), true);
  assert.equal(sessions, 1);
});
test('community login returns to /community and never a caller-supplied external URL', async () => {
  const auth = { init: async () => {}, account: () => ({ uid: 'same-uid' }), session: async () => { throw new Error('Must not request a workspace'); } };
  const navigations = [];
  const router = { navigateByUrl: async (...args) => navigations.push(args) };
  const route = { snapshot: { queryParamMap: { get: key => key === 'returnUrl' ? '/club?next=https://attacker.test' : null } } };
  class AuthToken {} class RouterToken {} class RouteToken {}
  const { SocialLoginComponent } = compile('components/login/social-login.component.ts', {
    '@angular/core': { Component: () => x => x, inject: token => token === AuthToken ? auth : token === RouterToken ? router : route },
    '@angular/router': { Router: RouterToken, ActivatedRoute: RouteToken }, '@angular/forms': { FormsModule: {} },
    '../../services/social-auth.service': { SocialAuthService: AuthToken }, '../../config/app-entry': { entryTemplate: () => undefined },
    '../../config/community-navigation': compile('config/community-navigation.ts', {}, {window: {location: {hostname: 'app.notionable.net'}}})
  }, { window: { location: { hostname: 'app.notionable.net' } } });
  await new SocialLoginComponent().continue();
  assert.equal(navigations[0][0], '/club');
  route.snapshot.queryParamMap.get = key => key === 'returnUrl' ? '/club?post=post-1&settings=notifications&next=https://attacker.test' : null;
  await new SocialLoginComponent().continue();
  assert.equal(navigations[1][0], '/club?post=post-1&settings=notifications');
});
