const { test } = require('node:test');
const assert = require('node:assert/strict');
const { marketingReport } = require('../lib/marketing-report');
const goals = { revenue: 100000, averagePrice: 10000, trafficConversion: 10, purchaseConversion: 10 };
test('unknown and zero denominators remain unmeasured', () => {
 const r = marketingReport({month:'2026-10',totalViews:0,productSales:{},sources:[]},goals,new Date('2026-10-31T12:00:00+09:00'));
 assert.deepEqual(r.metrics.map(m=>m.actual),[null,0,null,null]);
 assert.deepEqual(r.metrics.map(m=>m.target),[1000,100,10,10]);
 assert.throws(()=>marketingReport({sources:[]},{...goals,averagePrice:0}),/INVALID_GOALS/);
});
test('partial source conversion uses only measured source visits and reports pp gaps', () => {
 const r = marketingReport({month:'2026-10',totalViews:50,productSales:{lifeup:{count:2,revenue:20000}},sources:[{count:10,sourceViews:200},{count:40,sourceViews:null}]},goals,new Date('2026-10-31T12:00:00+09:00'));
 assert.deepEqual(r.metrics.map(m=>m.actual),[200,50,5,4]);
 assert.equal(r.metrics[2].gap,5);
 assert.ok(r.warnings.some(w=>w.includes('일부')));
});
test('volume targets use the elapsed Korean calendar days of the current month', () => {
 const r = marketingReport({month:'2026-10',totalViews:0,productSales:{},sources:[]},goals,new Date('2026-10-11T12:00:00+09:00'));
 assert.deepEqual(r.metrics.map(m=>m.target),[355,36,10,10]);
});
