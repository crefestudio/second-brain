const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../lib/recurring-schedule-model');
const schedule = (extra={}) => ({ id:'one',name:'Rent',icon:'',category:'Home',kind:'monthly',month:1,day:15,time:'09:00',duration:30,enabled:true,calendar:'solar',startDate:'2026-01-01',version:1,...extra });
test('month lengths, year boundary, KST boundary and disabled/start dates',()=>{
 assert.equal(model.MONTH_LENGTHS.reduce((a,b)=>a+b),365);
 assert.equal(model.koreaDate(new Date('2026-12-31T15:00:00Z')),'2027-01-01');
 assert.equal(model.isScheduleDue(schedule({day:31}),'2026-04-30'),false);
 assert.equal(model.isScheduleDue(schedule({day:31}),'2026-05-31'),true);
 assert.equal(model.isScheduleDue(schedule({kind:'yearly',month:12}),'2026-11-15'),false);
 assert.equal(model.isScheduleDue(schedule({enabled:false}),'2026-11-15'),false);
 assert.equal(model.isScheduleDue(schedule({startDate:'2026-11-16'}),'2026-11-15'),false);
 assert.equal(model.validateSchedule(schedule({kind:'yearly',month:2,day:29})), '');
 assert.notEqual(model.validateSchedule(schedule({calendar:'lunar'})), '');
});
test('overlap is limited to its repetition kind and date; all-day items may coexist',()=>{
 const a=schedule();
 assert.equal(model.scheduleConflict(a,schedule({id:'two',kind:'yearly'})),false);
 assert.equal(model.scheduleConflict(a,schedule({id:'two',day:16})),false);
 assert.equal(model.scheduleConflict(a,schedule({id:'two',time:'09:15'})),true);
 assert.equal(model.scheduleConflict(a,schedule({id:'two',time:'09:30'})),false);
 assert.equal(model.scheduleConflict(a,schedule({id:'two',name:'Other',time:''})),false);
 assert.equal(model.occurrenceKey(a.id,'2026-11-15'),'one:2026-11-15');
});
function setup(options={}) {
 const uid='u',root='users/u/integrations/recurringSchedules',today=model.koreaDate();
 const row=schedule({day:Number(today.slice(8)),startDate:today});
 const data=new Map([['users/u',{notionAccessToken:'test',notionConnectionId:'connection'}],[root,{enabled:true,sourceId:'source'}],[root+'/schedules/one',row]]);
 let serial=Promise.resolve(),creates=0,lookups=0;
 const pages=[];
 function snap(path){return {id:path.split('/').pop(),exists:data.has(path),data:()=>data.get(path)};}
 function collection(path){return {path,doc:(id='generated')=>ref(path+'/'+id),get:async()=>{const docs=[...data.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(snap);return {docs,size:docs.length};},orderBy(){return this;},limit(){return this;}};}
 function ref(path){return {path,id:path.split('/').pop(),collection:name=>collection(path+'/'+name),get:async()=>snap(path),set:async(value,opts)=>{data.set(path,opts?.merge?{...data.get(path),...value}:value);}};}
 const db={collection,runTransaction:fn=>{const result=serial.then(()=>fn({get:target=>target.get(),set:(target,value,opts)=>target.set(value,opts),delete:target=>data.delete(target.path)}));serial=result.catch(()=>{});return result;}};
 class FakeClient {constructor(opts){assert.equal(opts.retry,false);this.dataSources={retrieve:async()=>({properties:{'할일':{type:'title'},'날짜':{type:'date'},'유형':{type:'status'},'분류':{type:'select'},'자동생성 키':{type:'rich_text'}}}),query:async()=>{lookups++;return {results:options.invisible?[]:pages};}};this.pages={create:async request=>{creates++;assert.equal(request.properties['자동생성 키'].rich_text[0].text.content,'one:'+today);pages.push({id:'page',request});if(options.failAfterCreate)throw Error('response lost');return {id:'page'};}};}}
 const context={exports:{},require:name=>name==='@notionhq/client'?{Client:FakeClient}:name==='firebase-admin'?{firestore:{FieldValue:{serverTimestamp:()=>1}}}:name==='./recurring-schedule-model'?model:require(name),console:{error(){}},Date};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/recurring-schedules'),'utf8'),context);
 const api=context.exports.createRecurringSchedules({db,resolveDatabase:async()=> 'db',resolveSource:async()=>options.changedSource?'other':'source',assertConnection:async()=>{},allowed:()=>true});
 return {api,data,root,uid,row,receipt:()=>data.get(root+'/occurrences/one:'+today),creates:()=>creates,lookups:()=>lookups,pages};
}
test('concurrent invocations and later retries create only one Notion task',async()=>{
 const s=setup();await Promise.all([s.api.processUser(s.uid),s.api.processUser(s.uid)]);await s.api.processUser(s.uid);
 assert.equal(s.creates(),1);assert.equal(s.receipt().status,'created');
});
test('response loss recovers by key without another POST',async()=>{
 const s=setup({failAfterCreate:true});await s.api.processUser(s.uid);assert.equal(s.receipt().status,'review');
 await s.api.processUser(s.uid);assert.equal(s.creates(),1);assert.equal(s.receipt().status,'created');
});
test('ambiguous invisible result stays in review instead of creating duplicates',async()=>{
 const s=setup({failAfterCreate:true,invisible:true});await s.api.processUser(s.uid);await s.api.processUser(s.uid);await s.api.processUser(s.uid);
 assert.equal(s.creates(),1);assert.equal(s.receipt().status,'review');
});
test('stopping automation or changing destination prevents writes',async()=>{
 const s=setup();s.data.set(s.root,{enabled:false,sourceId:'source'});await s.api.processUser(s.uid);assert.equal(s.creates(),0);
 const other=setup({changedSource:true});await assert.rejects(()=>other.api.processUser(other.uid));assert.equal(other.creates(),0);
});
test('stale schedule edits are rejected and original IDs remain stable',async()=>{
 const s=setup();await s.api.save(s.uid,{...s.row,name:'Updated'});assert.equal(s.data.get(s.root+'/schedules/one').version,2);
 await assert.rejects(()=>s.api.save(s.uid,s.row));await assert.rejects(()=>s.api.remove(s.uid,'one',1));
 assert.equal(s.data.get(s.root+'/schedules/one').name,'Updated');
});

test('Korean lunar conversion, leap months and missing days never roll forward',()=>{
 const lunar=schedule({kind:'yearly',calendar:'lunar',month:1,day:1,startDate:'1900-01-01'});
 assert.deepEqual(model.yearlyDates(lunar,2026),['2026-02-17']);
 assert.equal(model.isScheduleDue(lunar,'2026-02-17'),true);
 assert.equal(model.isScheduleDue(lunar,'2026-01-01'),false);
 const leap={...lunar,month:6,leapMonth:true};
 assert.deepEqual(model.yearlyDates(leap,2025),['2025-07-25']);
 assert.deepEqual(model.yearlyDates(leap,2026),[]);
 assert.equal(model.isScheduleDue({...leap,leapMonth:false},'2025-07-25'),false);
 assert.equal(model.isScheduleDue(leap,'2025-07-25'),true);
 assert.deepEqual(model.yearlyDates({...lunar,calendar:'solar',month:2,day:29},2027),[]);
 assert.deepEqual(model.yearlyDates({...lunar,calendar:'solar',month:2,day:29},2028),['2028-02-29']);
 assert.equal(model.lunarDate('2051-01-01'),null);
 assert.notEqual(model.validateSchedule({...lunar,day:31}),'');
 assert.equal(model.scheduleConflict(lunar,{...lunar,id:'two',calendar:'solar',month:2,day:17}),true);
 assert.equal(model.scheduleConflict(leap,{...leap,id:'two',leapMonth:false}),false);
});
test('lunar dates persist and generate one solar-dated task with stable occurrence key',async()=>{
 const s=setup();const today=model.koreaDate(),lunar=model.lunarDate(today);
 await s.api.save(s.uid,{...s.row,kind:'yearly',calendar:'lunar',month:lunar.month,day:lunar.day,leapMonth:lunar.intercalation});
 const saved=s.data.get(s.root+'/schedules/one');assert.equal(saved.calendar,'lunar');assert.equal(saved.leapMonth,lunar.intercalation);
 await s.api.processUser(s.uid);await s.api.processUser(s.uid);assert.equal(s.creates(),1);assert.equal(s.receipt().date,today);assert.ok(s.pages[0].request.properties['할일'].title[0].text.content.startsWith('(음)'));assert.ok(s.pages[0].request.properties['날짜'].date.start.startsWith(today));
});

test('lunar year crossing and nonexistent lunar day 30 are exact',()=>{
 const lunar=schedule({kind:'yearly',calendar:'lunar',startDate:'1900-01-01',month:12,day:15});
 for(const date of model.yearlyDates(lunar,2026)){assert.ok(date.startsWith('2026-'));assert.equal(model.isScheduleDue(lunar,date),true);}
 let missing=false;for(let month=1;month<=12;month++){
  const value={...lunar,month,day:30};if(!model.yearlyDates(value,2026).length){missing=true;for(let day=1;day<=365;day++){const date=new Date(Date.UTC(2026,0,day)).toISOString().slice(0,10);assert.equal(model.isScheduleDue(value,date),false);}break;}
 }assert.equal(missing,true);
});
