const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const source=fs.readFileSync('src/app/components/pages/workspace/pages/recurring-schedules/schedule-countdown.ts','utf8');
const context={exports:{},require:()=>require('../functions/lib/recurring-schedule-model')};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const countdown=context.exports.yearlyCountdown;
const schedule=(id,month,day,extra={})=>({id,name:id,month,day,kind:'yearly',time:'',enabled:true,...extra});
test('today, upcoming, passed dates and paused yearly schedules sort by next occurrence',()=>{
 const list=countdown([schedule('past',11,6),schedule('next',11,8),schedule('today',11,7),schedule('paused',11,9,{enabled:false}),schedule('monthly',11,7,{kind:'monthly'})],'2026-11-07');
 assert.deepEqual(Array.from(list,x=>[x.schedule.id,x.days]),[['today',0],['next',1],['paused',2],['past',364]]);
 assert.equal(list[3].date,'2027-11-06');
});
test('year rollover and leap-day passage count actual calendar days',()=>{
 assert.equal(countdown([schedule('newyear',1,1)],'2026-12-31')[0].days,1);
 assert.equal(countdown([schedule('march',3,1)],'2028-02-28')[0].days,2);
 assert.equal(countdown([schedule('march',3,1)],'2027-02-28')[0].days,1);
});

test('lunar D-day skips absent leap months and includes unsupported dates without false rollover',()=>{
 const leap=schedule('leap',6,1,{calendar:'lunar',leapMonth:true});
 const result=countdown([leap],'2026-01-01')[0];assert.ok(result.date>'2026-12-31');
 assert.equal(countdown([leap],'2051-01-01')[0].days,null);
});
