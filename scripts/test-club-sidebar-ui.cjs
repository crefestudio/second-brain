// Real Angular + real chat API + real signal listener; all persistence is local emulator only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require('../tmp/community-ui-tools/node_modules/playwright');
const req=require('node:module').createRequire(path.resolve('functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
const {createCommunity}=require('../functions/lib/community');
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):/);
const root=path.resolve('.'),out=path.join(root,'tmp/club-sidebar-preview');fs.mkdirSync(out,{recursive:true});
const projectId='demo-club-sidebar-ui';
const entry=`import 'zone.js';import '@angular/compiler';
import {Component} from '@angular/core';import {bootstrapApplication} from '@angular/platform-browser';import {provideRouter,RouterOutlet} from '@angular/router';
import {initializeApp} from 'firebase/app';import {getFirestore,connectFirestoreEmulator,doc,onSnapshot} from 'firebase/firestore';
import {CommunityComponent} from './src/app/components/pages/community/community.component';
import {CommunityService} from './src/app/services/community.service';import {SocialAuthService} from './src/app/services/social-auth.service';
const uid=new URLSearchParams(location.search).get('uid')||'alice';
const db=getFirestore(initializeApp({projectId:'${projectId}',apiKey:'demo-key'}));connectFirestoreEmulator(db,'127.0.0.1',8189,{mockUserToken:{sub:uid,email_verified:true}});
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],template:'<router-outlet />'})class Root{}
bootstrapApplication(Root,{providers:[provideRouter([{path:'club',component:CommunityComponent}]),
{provide:SocialAuthService,useValue:{init:async()=>{},account:()=>({uid,displayName:uid})}},
{provide:CommunityService,useValue:{watchChat:(id,changed,failed)=>onSnapshot(doc(db,'communityChatSignals',id),changed,failed),request:async(action,data={})=>{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-Test-Uid':uid},body:JSON.stringify({...data,action})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}}}]}).catch(console.error);`;
(async()=>{
 const app=initializeApp({projectId},'club-chat-ui'),db=getFirestore(app);let clock=Date.now(),browser,server;
 const api=createCommunity(db,()=>clock);
 try{
  for(const name of ['communityMembers','communityMemberPrivate','communityChats','communityChatSignals','communityPosts','communityNotificationEvents'])await db.recursiveDelete(db.collection(name));
  for(const [uid,name] of [['alice','민지'],['bob','지훈']]){await db.doc('communityMembers/'+uid).set({name,active:true,joinedAt:1});await db.doc('communityMemberPrivate/'+uid).set({allowMemberDm:true,notificationSettings:{email:false,talk:false,confirmedAt:1}});}
  await db.doc('communityPosts/pin-example').set({title:'상단 고정 예시',body:'중요한 안내를 전체 글 위에서 확인하세요.',roomId:'lifeup',kind:'feed',authorId:'alice',authorName:'민지',visible:true,createdAt:clock,updatedAt:clock,version:1,likes:0,comments:0,acceptedCommentId:null});
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
  await db.doc('communityPosts/plain-example').set({title:'노션 활용 이야기',body:'일반 글',roomId:'notion',kind:'feed',authorId:'bob',authorName:'지훈',visible:true,createdAt:clock+1,updatedAt:clock,version:1,likes:7,comments:0,acceptedCommentId:null});
  await alice.goto(url+'/club?uid=alice');await alice.locator('.post-card').first().waitFor();
  await alice.getByRole('button',{name:'상단 고정 예시 상단 고정',exact:true}).click();
  await alice.locator('#pin-mode').selectOption('day');await alice.getByRole('button',{name:'저장하기',exact:true}).click();
  await alice.locator('.dialog').waitFor({state:'hidden'});await alice.locator('.sidebar-post-link').first().waitFor();
  assert.equal(await alice.locator('.pinned-sidebar section').count(),2);
  assert.equal(await alice.locator('.popular-posts .sidebar-post-link>span').innerText(),'노션 활용 이야기');
  assert.equal(await alice.locator('.pinned-sidebar .channel-badge').count(),0);
  assert.equal(await alice.locator('.pinned-sidebar-description').count(),0);
  const pinnedCard=alice.locator('.feed-column>.post-card').filter({hasText:'상단 고정 예시'});assert.equal(await pinnedCard.locator('.channel-badge').count(),0);
  const badge=alice.getByRole('link',{name:'노션 방으로 이동',exact:true});const date=alice.locator('.post-card').filter({hasText:'노션 활용 이야기'}).locator('.post-date-row small');
  const badgeBox=await badge.boundingBox(),dateBox=await date.boundingBox();assert.ok(badgeBox.x>dateBox.x+dateBox.width);assert.ok(Math.abs((badgeBox.y+badgeBox.height/2)-(dateBox.y+dateBox.height/2))<2);
  async function alignment(page){await page.waitForTimeout(150);const columns=await page.locator('.content-columns').boundingBox(),sidebar=await page.locator('.pinned-sidebar').boundingBox();assert.ok(Math.abs(columns.y-sidebar.y)<2,JSON.stringify({columns,sidebar}));const cover=await page.locator('.room-header').boundingBox(),notice=await page.locator('.development-notice').boundingBox();assert.ok(Math.abs(cover.x-notice.x)<2);assert.ok(Math.abs(cover.width-notice.width)<2);}
  await alignment(alice);const status=await alice.locator('.main-area>.notice').boundingBox(),cover=await alice.locator('.room-header').boundingBox();assert.ok(Math.abs(status.width-cover.width)<2);
  await alice.screenshot({path:path.join(out,'all-desktop.png'),fullPage:true});
  await badge.click();await alice.locator('.composer').waitFor();assert.equal(new URL(alice.url()).searchParams.get('room'),'notion');assert.equal(await alice.locator('.channel-badge').count(),0);assert.equal(await alice.locator('.pinned-sidebar').count(),0);
  await alice.goto(url+'/club?uid=alice&room=lifeup');await alice.locator('.pinned-card').waitFor();assert.equal(await alice.locator('.channel-badge').count(),0);await alignment(alice);await alice.screenshot({path:path.join(out,'room-desktop.png'),fullPage:true});
  await alice.locator('.sidebar-post-link').click();await alice.locator('.post-detail').waitFor();assert.equal(await alice.locator('.channel-badge').count(),0);
  await alice.goto(url+'/club?uid=alice&view=mine');await alice.locator('.composer').waitFor();await alignment(alice);assert.equal(await alice.locator('.popular-posts').count(),0);
  await bob.goto(url+'/club?uid=bob');await bob.locator('.sidebar-post-link').first().waitFor();assert.ok(await bob.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await bob.screenshot({path:path.join(out,'all-mobile.png'),fullPage:true});
  await bob.locator('.popular-posts .sidebar-post-link').click();await bob.locator('.post-detail').waitFor();assert.ok((await bob.locator('.post-detail h2').innerText()).includes('노션 활용 이야기'));
  await alice.goto(url+'/club?uid=alice&post=pin-example');await alice.locator('.post-detail').waitFor();
  const author=await alice.locator('.post-detail>.author-row').boundingBox(),body=await alice.locator('.post-detail>community-document').boundingBox(),title=await alice.locator('.post-detail>h2').boundingBox();
  assert.ok(body.y-(author.y+author.height)>=24);assert.ok(title.y+title.height<author.y);
  assert.equal(await alice.locator('.post-detail .admin-tag').evaluate(el=>getComputedStyle(el).fontSize),'10px');
  await alice.screenshot({path:path.join(out,'detail-desktop.png'),fullPage:true});
  await alice.goto(url+'/club?uid=alice');await alice.locator('.feed-post').first().waitFor();
  const card=alice.locator('.feed-post').first(),ct=await card.locator('.post-title').boundingBox(),ca=await card.locator('.author-row').boundingBox(),cb=await card.locator('.post-excerpt').boundingBox();assert.ok(ct.y+ct.height<ca.y);assert.ok(cb.y-ca.y-ca.height>=22);
  await alice.getByRole('button',{name:'글쓰기',exact:true}).click();assert.equal(await alice.locator('#post-kind option[value="feed"]').innerText(),'이야기');
  await api({uid:'alice',isAdmin:true},{action:'pinPost',postId:'pin-example',mode:'none'});
  await alice.goto(url+'/club?uid=alice');await alice.locator('.feed-post').first().waitFor();assert.equal(await alice.locator('.pinned-sidebar').count(),0);assert.equal(await alice.locator('.with-pins').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: sidebar visibility including empty all-feed, title-author-body order and spacing, compact admin badge, editor labels, banner/sidebar alignment, mobile and links.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
