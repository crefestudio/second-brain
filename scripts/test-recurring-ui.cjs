// Real component/template with fake session/storage; no production calls.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const ts = require('typescript');
const sass = require('sass');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const base = path.join(root,'src/app/components/pages/workspace/pages/recurring-schedules');
const out = fs.mkdtempSync(path.join(os.tmpdir(),'recurring-ui-'));
const entry = String.raw`
import 'zone.js'; import '@angular/compiler';
import { Component } from '@angular/core'; import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RecurringSchedulesComponent } from './src/app/components/pages/workspace/pages/recurring-schedules/recurring-schedules.component';
import { AuthService } from './src/app/services/auth.service';
import { RecurringSchedulesService } from './src/app/services/recurring-schedules.service';
let state={enabled:false,receipts:[],schedules:[{id:'sample',name:'관리비 납부하기',icon:'🏠',category:'생활',kind:'monthly',month:1,day:5,time:'09:00',duration:30,enabled:false,calendar:'solar',startDate:'2026-01-01',version:1}]};
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],template:'<router-outlet />'}) class Root {}
bootstrapApplication(Root,{providers:[provideRouter([{path:'workspace/recurring-schedules/:tab',component:RecurringSchedulesComponent}]),
{provide:AuthService,useValue:{updateSession:async()=>{},getUserId:()=> 'test',getNotionAccessToken:()=> 'connected',templateId:'lifeUp'}},
{provide:RecurringSchedulesService,useValue:{request:async(userId,action,data)=>{
 if(action==='save'){const s={...data.schedule,id:data.schedule.id||'new-'+state.schedules.length,version:data.schedule.version+1};state.schedules=state.schedules.filter(x=>x.id!==s.id).concat(s);}
 if(action==='delete')state.schedules=state.schedules.filter(x=>x.id!==data.id);
 if(action==='enable')state.enabled=data.enabled;
 return structuredClone(state);
}}}]}).catch(console.error);
`;
(async()=>{
 await esbuild.build({stdin:{contents:entry,loader:'ts',resolveDir:root},bundle:true,format:'iife',outfile:path.join(out,'app.js'),tsconfigRaw:{compilerOptions:{experimentalDecorators:true}},plugins:[{name:'isolated-angular',setup(build){
  build.onLoad({filter:/recurring-schedules\.component\.ts$/},args=>{
   let source=fs.readFileSync(args.path,'utf8').replace('import { Component,','import { inject, Component,');
   source=source.replace(/templateUrl:'[^']+', styleUrls:\[[\s\S]*?\]/, match => { const paths=[...match.matchAll(/'([^']+\.(?:scss|css))'/g)].map(m=>m[1]); return 'template:'+JSON.stringify(fs.readFileSync(path.join(base,'recurring-schedules.component.html'),'utf8'))+',styles:'+JSON.stringify(paths.map(p=>sass.compile(path.resolve(base,p)).css)); });
   source=source.replace(/constructor\(private auth:[^\n]+\{\}/,'constructor(){ this.auth=inject(AuthService);this.api=inject(RecurringSchedulesService);this.route=inject(ActivatedRoute);this.router=inject(Router); }');
   return {contents:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText,loader:'js',resolveDir:base};
  });
  build.onLoad({filter:/[\\/]services[\\/](auth|recurring-schedules)\.service\.ts$/},args=>({contents:args.path.endsWith('auth.service.ts')?'export class AuthService {}':'export class RecurringSchedulesService {}',loader:'js'}));
 }}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?fs.readFileSync(path.join(out,'app.js')):'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#121212;color:#e5e7eb;font-family:Arial,sans-serif}*{box-sizing:border-box}</style><app-root></app-root><script src="/app.js"></script></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1360,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/workspace/recurring-schedules/mine');
 await page.locator('.date-cell').first().waitFor();assert.equal(await page.locator('[data-schedule-day]').count(),31);
 await page.locator('.schedule-card').first().waitFor();
 const card=page.locator('.schedule-card').first(),target=page.locator('[data-schedule-day="10"]');const a=await card.boundingBox(),b=await target.boundingBox();
 await page.mouse.move(a.x+20,a.y+10);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
 await page.locator('[data-schedule-day="10"] .schedule-card').waitFor();
 await page.getByRole('button',{name:'1월 1일에 일정 추가',exact:true}).click();await page.locator('#schedule-name').fill('방금 등록한 1일 일정');await page.getByRole('button',{name:'저장하기',exact:true}).click();await page.locator('[role=dialog]').waitFor({state:'hidden'});
 await page.screenshot({path:path.join(out,'monthly.png'),fullPage:true});
 await page.getByRole('button',{name:'연간 반복 일정',exact:true}).click();assert.equal(await page.locator('[data-schedule-day]').count(),365);
 await page.getByRole('button',{name:'내년',exact:true}).click();await page.getByRole('button',{name:'내년',exact:true}).click();assert.equal(await page.locator('[data-schedule-day]').count(),366);
 await page.getByRole('button',{name:'이전 년',exact:true}).click();await page.getByRole('button',{name:'이전 년',exact:true}).click();
 await page.getByRole('button',{name:'3월 15일에 일정 추가',exact:true}).click();
 await page.locator('#schedule-name').fill('기념일 테스트');await page.locator('#schedule-status').selectOption({label:'일시 정지'});
 await page.getByRole('button',{name:'이모지 선택',exact:true}).click();
 assert.ok(await page.locator('#schedule-icon-options button').count()>50);
 await page.getByRole('button',{name:'💊 선택',exact:true}).click();assert.equal(await page.locator('#schedule-icon').inputValue(),'💊');
 await page.locator('#schedule-icon').fill('🦊');await page.locator('#schedule-icon').press('ArrowDown');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#schedule-icon-options').count(),0);assert.equal(await page.locator('[role=dialog]').count(),1);
 await page.getByRole('button',{name:'이모지 선택',exact:true}).click();await page.getByRole('button',{name:'💕 선택',exact:true}).click();
 await page.getByRole('button',{name:'저장하기',exact:true}).click();await page.locator('[role=dialog]').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-schedule-month="3"][data-schedule-day="15"] .schedule-card').count(),1);
 const yearlyCard=page.locator('[data-schedule-month="3"][data-schedule-day="15"] .schedule-card');
 await yearlyCard.scrollIntoViewIfNeeded();const start=await yearlyCard.boundingBox();
 await page.mouse.move(start.x+15,start.y+10);await page.mouse.down();
 const april=page.locator('[data-schedule-month="4"][data-schedule-day="1"]');await april.scrollIntoViewIfNeeded();const end=await april.boundingBox();
 await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:10});await page.mouse.up();
 await page.locator('[data-schedule-month="4"][data-schedule-day="1"] .schedule-card').waitFor();
 await page.screenshot({path:path.join(out,'yearly.png'),fullPage:true});
 await page.locator('#schedule-month-1').screenshot({path:path.join(out,'yearly-january.png')});
 const jan=page.locator('#schedule-month-1');assert.equal(await jan.locator('[data-schedule-day="31"]').evaluate(n=>getComputedStyle(n).borderRightWidth),'1px');
 assert.ok(await jan.locator('[data-schedule-day="1"]').evaluate(n=>n.getBoundingClientRect().height)>=115);
 await page.getByRole('button',{name:'1월 1일에 일정 추가',exact:true}).click();await page.locator('#schedule-name').fill('음력 설 테스트');
 await page.locator('#schedule-calendar').selectOption('lunar');await page.locator('#schedule-month').selectOption({label:'1월'});await page.locator('#schedule-day').selectOption({label:'1일'});
 assert.ok(!(await page.locator('[role=dialog]').innerText()).includes('양력 날짜:'));
 await page.getByRole('button',{name:'저장하기',exact:true}).click();await page.locator('[role=dialog]').waitFor({state:'hidden'});
 const lunarCard=page.locator('[data-schedule-month="2"][data-schedule-day="17"] .schedule-card');await lunarCard.waitFor();assert.ok((await lunarCard.innerText()).includes('(음)'));
 await lunarCard.scrollIntoViewIfNeeded();const lc=await lunarCard.boundingBox();const dest=page.locator('[data-schedule-month="2"][data-schedule-day="18"]');const ld=await dest.boundingBox();
 await page.mouse.move(lc.x+12,lc.y+10);await page.mouse.down();await page.mouse.move(ld.x+ld.width/2,ld.y+ld.height/2,{steps:10});await page.mouse.up();await dest.locator('.schedule-card').waitFor();
 await dest.locator('.schedule-card').click();assert.equal(await page.locator('#schedule-calendar').inputValue(),'lunar');assert.equal(await page.locator('#schedule-day option:checked').innerText(),'2일');await page.setViewportSize({width:390,height:844});
 const fields=await page.locator('[data-date-fields] select').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert.equal(new Set(fields).size,1);
 const buttons=await page.locator('[data-editor-actions] button').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,y:n.getBoundingClientRect().y})));assert.equal(buttons[0].w,buttons[1].w);assert.equal(buttons[0].y,buttons[1].y);
 await page.getByRole('button',{name:'이모지 선택',exact:true}).click();
 const pickerBounds=await page.locator('#schedule-icon-options').boundingBox();assert.ok(pickerBounds.x>=0 && pickerBounds.x+pickerBounds.width<=390);
 await page.screenshot({path:path.join(out,'editor-mobile.png'),fullPage:true});await page.keyboard.press('Escape');await page.setViewportSize({width:1360,height:1000});await page.getByRole('button',{name:'닫기',exact:true}).click();

 await page.getByRole('link',{name:'추천 반복 일정',exact:true}).click();await page.getByRole('button',{name:'월간 반복 일정',exact:true}).click();assert.equal(await page.locator('.recommendation-card').count(),23);
 await page.getByRole('button',{name:'연간 반복 일정',exact:true}).click();assert.equal(await page.locator('.recommendation-card').count(),33);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'recommendations-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.getByRole('link',{name:'대시보드',exact:true}).click();assert.equal(await page.locator('.dashboard-schedule-panels > section').count(),2);assert.equal(await page.locator('[data-countdown-row]').count(),2);
 const inactiveMonth=page.locator('[data-month-schedule]').filter({hasText:'관리비 납부하기'});assert.ok((await inactiveMonth.innerText()).includes('⏸ (비활성)'));assert.equal(await inactiveMonth.evaluate(n=>getComputedStyle(n).color),'rgb(139, 148, 158)');
 const inactiveYear=page.locator('[data-countdown-row]').filter({hasText:'기념일 테스트'});assert.ok((await inactiveYear.innerText()).includes('⏸ (비활성)'));assert.equal(await inactiveYear.evaluate(n=>getComputedStyle(n).color),'rgb(139, 148, 158)');
 assert.equal(await page.getByText('전체 연간 일정',{exact:true}).count(),0);
 const autoRegistration=page.getByRole('button',{name:'연결 준비 및 자동 등록 켜기',exact:true});assert.equal(await autoRegistration.isVisible(),false);
 await page.locator('summary').click();assert.equal(await autoRegistration.isVisible(),true);await page.locator('summary').click();
 assert.equal(await page.getByRole('button',{name:'오늘 일정 동기화',exact:true}).isEnabled(),false);

 const firstDay=page.locator('[data-month-schedule]').filter({hasText:'방금 등록한 1일 일정'});assert.equal(await firstDay.count(),1);assert.equal(await firstDay.evaluate(n=>getComputedStyle(n).color),'rgb(139, 148, 158)');assert.deepEqual(await page.locator('[aria-labelledby="month-list-title"] th').allTextContents(),['날짜','시간','일정 이름']);await page.screenshot({path:path.join(out,'dashboard-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1360,height:1000});await page.screenshot({path:path.join(out,'dashboard-desktop.png'),fullPage:true});
 const boxes=await page.locator('.dashboard-schedule-panels > section').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));assert.equal(boxes[0].y,boxes[1].y);assert.ok(boxes[1].x>boxes[0].x);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({success:true,screenshots:out,checks:['31 cells','365 cells','monthly drag','yearly create and drag across months','23 monthly recommendations','33 yearly recommendations','mobile overflow','no browser errors']}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
