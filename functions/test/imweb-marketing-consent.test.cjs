const {test} = require('node:test');
const assert = require('node:assert/strict');
const {syncImwebMarketingConsents,consentEmailId} = require('../lib/imweb-marketing-consent');
function fixture(initial={}) {
 const records=new Map(Object.entries(initial));
 const ref=path=>({path,set:async(data,options)=>records.set(path,options?.merge?{...records.get(path),...data}:data),collection:name=>({doc:()=>ref(path+'/'+name+'/history')})});
 return {records,db:{collection:name=>({
   doc:id=>ref(name+'/'+id),where:()=>({limit:()=>({get:async()=>({empty:false})})}),
   get:async()=>({docs:[...records].filter(([key])=>key.startsWith(name+'/')&&key.split('/').length===2).map(([key,data])=>({data:()=>data,ref:ref(key)}))})
 }),runTransaction:async fn=>fn({get:async r=>({data:()=>records.get(r.path),exists:records.has(r.path)}),set:(r,d)=>records.set(r.path,d)})}};
}
test('sync separates channels, creates history and records successful completion',async()=>{
 const f=fixture();const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({code:200,data:{list:[{member_code:'m1',email:'TEST@example.com',marketing_agree_email:'Y',marketing_agree_sms:'N'}]}})});
 try {
   assert.deepEqual(await syncImwebMarketingConsents(f.db,'token'),{members:1,emails:1});
   const value=f.records.get('imwebMarketingConsents/'+consentEmailId('test@example.com'));
   assert.equal(value.marketingEmailConsent,true);assert.equal(value.marketingSmsConsent,false);
   assert.ok(f.records.has('integrationSync/imwebMarketingConsents'));
 }finally{global.fetch=original;}
});
test('invalid API response leaves previously saved permissions unchanged',async()=>{
 const f=fixture({'imwebMarketingConsents/a':{email:'a@example.com',marketingEmailConsent:true}});const original=global.fetch;
 global.fetch=async()=>({ok:false,json:async()=>({code:403})});
 try{await assert.rejects(syncImwebMarketingConsents(f.db,'token'));assert.equal(f.records.get('imwebMarketingConsents/a').marketingEmailConsent,true);}
 finally{global.fetch=original;}
});
