// Real Angular + real chat API + real signal listener; all persistence is local emulator only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require('../tmp/community-ui-tools/node_modules/playwright');
const {memoryDb}=require('../functions/test/helpers/memory-db.cjs');
const {createCommunity}=require('../functions/lib/community');
const root=path.resolve('.'),out=path.join(root,'tmp/club-newsletter-preview');fs.mkdirSync(out,{recursive:true});
const projectId='demo-club-editor-ui';
const entry=`import 'zone.js';import '@angular/compiler';
import {Component} from '@angular/core';import {bootstrapApplication} from '@angular/platform-browser';import {provideRouter,RouterOutlet} from '@angular/router';
import {CommunityComponent} from './src/app/components/pages/community/community.component';
import {CommunityService} from './src/app/services/community.service';import {SocialAuthService} from './src/app/services/social-auth.service';
const uid=new URLSearchParams(location.search).get('uid')||'alice';
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],template:'<router-outlet />'})class Root{}
bootstrapApplication(Root,{providers:[provideRouter([{path:'club',component:CommunityComponent}]),
{provide:SocialAuthService,useValue:{init:async()=>{},account:()=>({uid,displayName:uid})}},
{provide:CommunityService,useValue:{watchChat:()=>()=>{},request:async(action,data={})=>{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-Test-Uid':uid},body:JSON.stringify({...data,action})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}}}]}).catch(console.error);`;
(async()=>{
 const {db}=memoryDb({}); db.doc=p=>db.collection(p.slice(0,p.lastIndexOf('/'))).doc(p.split('/').pop());let clock=Date.now(),browser,server;
 const api=createCommunity(db,()=>clock);
 try{
  for(const [uid,name] of [['alice','민지'],['bob','지훈']]){await db.doc('communityMembers/'+uid).set({name,active:true,joinedAt:1});await db.doc('communityMemberPrivate/'+uid).set({allowMemberDm:true,notificationSettings:{email:false,talk:false,confirmedAt:1}});}
  await db.doc('communityPosts/pin-example').set({title:'상단 고정 예시',body:'중요한 안내를 전체 글 위에서 확인하세요.',roomId:'lifeup',kind:'feed',authorId:'alice',authorName:'민지',visible:true,createdAt:clock,updatedAt:clock,version:1,newsletterRequestedAt:clock-600000,newsletterSentCount:3,likes:0,comments:0,acceptedCommentId:null});
  await esbuild.build({stdin:{contents:entry,loader:'ts',resolveDir:root},bundle:true,target:'es2016',format:'iife',outfile:path.join(out,'app.js'),tsconfigRaw:{compilerOptions:{experimentalDecorators:true}},plugins:[{name:'fixture',setup(build){
   build.onLoad({filter:/community(?:-[\w-]+)?\.component\.ts$/},args=>{
    let s=fs.readFileSync(args.path,'utf8');s=s.replace(/templateUrl:\s*'([^']+)',\s*styleUrls:\s*\[([^\]]+)\]/,(_,html,styles)=>'template: '+JSON.stringify(fs.readFileSync(path.join(path.dirname(args.path),html),'utf8'))+', styles: '+JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m=>fs.readFileSync(path.join(path.dirname(args.path),m[1]),'utf8'))));
    s=s.replace(/styleUrls:\s*\[([^\]]+)\]/g,(_,styles)=>'styles: '+JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m=>fs.readFileSync(path.join(path.dirname(args.path),m[1]),'utf8'))));
    return{contents:ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText,loader:'js',resolveDir:path.dirname(args.path)};
   });
   build.onLoad({filter:/[\\/]services[\\/](social-auth|community)\.service\.ts$/},args=>({contents:args.path.endsWith('social-auth.service.ts')?'export class SocialAuthService {}':"export class CommunityService {} export {COMMUNITY_ROOMS} from '../../../functions/src/community-model';",loader:'ts',resolveDir:path.dirname(args.path)}));
  }}]});
  server=http.createServer(async(r,s)=>{
   if(r.url==='/api'){let body='';for await(const chunk of r)body+=chunk;const input=JSON.parse(body);if(input.action==='notifications')await new Promise(resolve=>setTimeout(resolve,700));clock+=2000;s.setHeader('Content-Type','application/json');try{s.end(JSON.stringify(await api({uid:r.headers['x-test-uid'],name:'test',isAdmin:r.headers['x-test-uid']==='alice'},input)));}catch(e){s.statusCode=e.status||500;s.end(JSON.stringify({error:e.message}));}return;}
   const url=new URL(r.url,'http://localhost');if(url.pathname.startsWith('/assets/')){const file=path.resolve(root,'src','.'+url.pathname);if(!file.startsWith(path.join(root,'src','assets')+path.sep)||!fs.existsSync(file)){s.writeHead(404);s.end();return;}s.end(fs.readFileSync(file));return;}
   s.setHeader('Content-Type',url.pathname==='/app.js'?'application/javascript':'text/html;charset=utf-8');s.end(url.pathname==='/app.js'?fs.readFileSync(path.join(out,'app.js')):'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><app-root></app-root><script src="/app.js"></script>');
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'msedge',headless:true});
  const alice=await browser.newPage({viewport:{width:1440,height:1000}}),bob=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  for(const p of [alice,bob])p.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port;
  await alice.goto(url+'/club?uid=alice');await bob.goto(url+'/club?uid=bob');
  await alice.goto(url+'/club?uid=alice&post=pin-example');await alice.locator('.post-detail').waitFor();
  assert.equal(await alice.getByRole('button',{name:'뉴스레터 미리보기',exact:true}).count(),0);
  await alice.locator('.post-detail .author-tools').getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await alice.locator('.publish-buttons button').count(),4);
  assert.match(await alice.locator('.newsletter-status').innerText(),/누적 3건/);
  assert.equal(await alice.locator('.share-badges [title*=뉴스레터]').count(),0);
  assert.equal(await alice.locator('.publish-buttons button:disabled').count(),3);
  assert.equal(await alice.locator('input[name="shareNewsletter"]').count(),0);
  await alice.locator('input[name="title"]').fill('수정한 뉴스레터 제목');
  await alice.getByRole('button',{name:'뉴스레터 미리보기',exact:true}).click();
  await alice.frameLocator('.newsletter-preview').getByRole('heading',{name:'수정한 뉴스레터 제목'}).waitFor();
  assert.ok((await alice.frameLocator('.newsletter-preview').locator('body').innerText()).includes('민지 · 라이프업 · 게시일'));
  assert.equal(await alice.frameLocator('.newsletter-preview').getByRole('link',{name:'클럽 메일 수신 설정',exact:true}).getAttribute('href'),'https://club.notionable.net/?settings=notifications');
  assert.equal(await alice.frameLocator('.newsletter-preview').getByRole('link',{name:'전체 알림 수신 거부 (차단)',exact:true}).count(),0);
  assert.equal(Math.round((await alice.locator('.newsletter-preview').boundingBox()).width),704);
  assert.equal(Math.round(await alice.frameLocator('.newsletter-preview').locator('body>div>div').evaluate(el=>el.getBoundingClientRect().width)),640);
  assert.equal((await db.collection('communityNotificationEvents').get()).size,0);
  assert.equal((await db.doc('communityPosts/pin-example').get()).get('title'),'수정한 뉴스레터 제목');
  await alice.screenshot({path:path.join(out,'newsletter-dialog.png'),fullPage:true});
  await alice.getByRole('button',{name:'수신 허용 회원에게 발송',exact:true}).click();
  await alice.locator('.dialog').waitFor({state:'hidden'});
  const events=await db.collection('communityNotificationEvents').get();assert.equal(events.size,1);assert.equal(events.docs[0].get('manualNewsletter'),true);
  await bob.goto(url+'/club?uid=bob&post=pin-example');await bob.locator('.post-detail').waitFor();assert.equal(await bob.getByRole('button',{name:'뉴스레터 미리보기',exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('PASS admin newsletter preview, metadata, club settings footer and 640px width, local-only send request and member button hiding. No external email sent.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
