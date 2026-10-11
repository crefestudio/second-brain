const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { saveStoreVisit, VISIT_WINDOW_MS } = require('../lib/store-visit');
function harness() {
 const docs = new Map(); let serial = Promise.resolve(); let id = 0;
 const db = { collection: name => ({doc: key => ({path: `${name}/${key || ++id}`})}), runTransaction: fn => {
   const run = serial.then(async () => {
     const writes = [];
     const result = await fn({ get: async ref => ({data: () => docs.get(ref.path)}), set: (ref, data) => writes.push([ref.path, data]) });
     for (const [path, data] of writes) docs.set(path, data);
     return result;
   }); serial = run.catch(()=>{}); return run;
 } };
 return {db, docs};
}
const visit = () => ({sessionId:'browser',productPath:'lifeup',location:'video',referrer:'',occurredAt:Timestamp.now()});
test('repeat requests count once; different products, sources and browsers count separately',async()=>{
 const h=harness(); const v=visit();
 const results=await Promise.all([saveStoreVisit(h.db,v),saveStoreVisit(h.db,v)]);
 assert.deepEqual(results.map(r=>r.recorded),[true,false]);
 for(const change of [{productPath:'lifeup-imweb'},{location:'other'},{sessionId:'other'}]) assert.equal((await saveStoreVisit(h.db,{...v,...change})).recorded,true);
 assert.equal([...h.docs.keys()].filter(k=>k.startsWith('storeVisits/')).length,4);
});
test('window expires from accepted visit; blocked retries do not extend it',async()=>{
 const h=harness(); const v=visit(); await saveStoreVisit(h.db,v);
 const key=[...h.docs.keys()].find(k=>k.startsWith('storeVisitDedup/'));
 const last=h.docs.get(key).createdAt;
 assert.equal((await saveStoreVisit(h.db,v)).recorded,false);
 assert.equal(h.docs.get(key).createdAt,last);
 h.docs.set(key,{createdAt:Timestamp.fromMillis(Date.now()-VISIT_WINDOW_MS)});
 assert.equal((await saveStoreVisit(h.db,v)).recorded,true);
});
test('reset rejects old requests and permits new events despite old dedup state',async()=>{
 const h=harness(); const v=visit(); await saveStoreVisit(h.db,v);
 const resetAt=Timestamp.fromMillis(Date.now()+1);
 h.docs.set('storeVisitSettings/reset',{resetAt});
 assert.equal((await saveStoreVisit(h.db,v)).ignored,'RESET');
 assert.equal((await saveStoreVisit(h.db,{...v,occurredAt:Timestamp.fromMillis(resetAt.toMillis()+1)})).recorded,true);
});
