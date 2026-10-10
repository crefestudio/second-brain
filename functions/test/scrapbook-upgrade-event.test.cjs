const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/index.ts'), 'utf8');
const section = source.slice(source.indexOf('export const getScrapbookUpgradeEvent ='), source.indexOf('// #template\n// #lifeup template', source.indexOf('export const getScrapbookUpgradeEvent =')));
function setup(workspace, authenticated = true) {
  let writes = 0;
  const ref = {id:'workspace'};
  const db = {collection: name => ({doc: () => name === 'users' ? ref : {id:'account'}}),
    runTransaction: fn => fn({get: async r => ({exists: !!workspace, data: () => r === ref ? workspace : {}}),
      set: (_, value) => {writes++; Object.assign(workspace, value);}})};
  const context = {exports:{}, onRequest:fn=>fn, withCors:fn=>fn, db, Date,
    admin:{auth:()=>({verifyIdToken:async()=>{if(!authenticated) throw Error(); return {uid:'owner'};}}),
      firestore:{Timestamp:{now:()=>({toMillis:()=>1000})}}}};
  vm.runInNewContext(ts.transpileModule(section,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, context);
  return {writes:()=>writes, call:async id=>{
    const res={code:200,status(c){this.code=c;return this;},json(body){this.body=body;},end(){}};
    await context.exports.getScrapbookUpgradeEvent({method:'POST',headers:{authorization:'Bearer token'},body:{workspaceId:id}},res);
    return res;
  }};
}
test('rejects unauthenticated and missing workspace requests without writes',async()=>{
  for(const [auth,id,code] of [[false,'w',401],[true,'',400]]) {
    const s=setup({},auth); assert.equal((await s.call(id)).code,code); assert.equal(s.writes(),0);
  }
});
test('rejects nonexistent, foreign, and LifeUp workspaces',async()=>{
  for(const workspace of [undefined,{firebaseUid:'other',templateId:'lifeUpScrapbook'},{firebaseUid:'owner',templateId:'lifeUp'}]) {
    const s=setup(workspace); assert.equal((await s.call('w')).code,403); assert.equal(s.writes(),0);
  }
});
test('Scrapbook workspace timestamp remains identical on repeated visits',async()=>{
  const s=setup({firebaseUid:'owner',templateId:'lifeUpScrapbook'});
  assert.equal((await s.call('w')).body.firstSeenAt,1000);
  assert.equal((await s.call('w')).body.firstSeenAt,1000);
  assert.equal(s.writes(),1);
});
