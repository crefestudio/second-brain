// Real Angular + real chat API + real signal listener; all persistence is local emulator only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require('../tmp/community-ui-tools/node_modules/playwright');
const req=require('node:module').createRequire(path.resolve('functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
const {createCommunity}=require('../functions/lib/community');
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):/);
const root=path.resolve('.'),out=path.join(root,'tmp/club-chat-preview');fs.mkdirSync(out,{recursive:true});
const projectId='demo-club-chat-ui';
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
  for(const name of ['communityMembers','communityMemberPrivate','communityChats','communityChatSignals'])await db.recursiveDelete(db.collection(name));
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
  await alice.goto(url+'/club?uid=alice');await bob.goto(url+'/club?uid=bob');
  async function settings(page) { await page.getByRole('button',{name:'계정 메뉴'}).click(); await page.getByRole('button',{name:'클럽 설정',exact:true}).click(); await page.getByRole('button',{name:/알림 수신 설정/}).click(); }
  await settings(alice);
  assert.equal(await alice.locator('.notification-matrix tbody th span').first().innerText(),'내 활동 알림');
  assert.equal(await alice.locator('.notification-matrix input[type="checkbox"]').count(),8);
  await alice.getByLabel('중요 기본 공지 안내 메일',{exact:true}).check();
  await alice.getByLabel('이벤트 알림 톡',{exact:true}).check();
  await alice.screenshot({path:path.join(out,'notification-settings-desktop.png')});
  await alice.getByRole('button',{name:'저장하기',exact:true}).click();
  await alice.reload();await settings(alice);
  assert.ok(await alice.getByLabel('중요 기본 공지 안내 메일',{exact:true}).isChecked());
  assert.ok(await alice.getByLabel('이벤트 알림 톡',{exact:true}).isChecked());
  assert.equal(await alice.getByLabel('이벤트 알림 메일',{exact:true}).isChecked(),false);
  assert.equal(await alice.getByLabel('중요 기본 공지 안내 톡',{exact:true}).isChecked(),false);
  await alice.setViewportSize({width:390,height:844});await alice.screenshot({path:path.join(out,'notification-settings-mobile.png')});
  assert.ok(await alice.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await alice.getByRole('button',{name:'닫기',exact:true}).last().click();await alice.setViewportSize({width:1440,height:1000});
  assert.deepEqual(await alice.locator('.brand-club').evaluate(el=>[getComputedStyle(el).fontSize,getComputedStyle(el).marginLeft]),['22px','-6px']);
  await alice.getByRole('button',{name:'상단 고정 예시 상단 고정',exact:true}).click();
  await alice.locator('#pin-mode').selectOption('day');await alice.getByRole('button',{name:'저장하기',exact:true}).click();
  await alice.locator('.dialog').waitFor({state:'hidden'});
  assert.equal(await alice.locator('.pinned-sidebar').count(),1);
  await alice.locator('.room-button').filter({hasText:'라이프업'}).click();
  await alice.locator('.pinned-card').waitFor();assert.equal(await alice.locator('.pinned-card').count(),1);
  assert.equal(await alice.locator('.feed-column>.post-card').count(),0);
  await alice.screenshot({path:path.join(out,'pinned-post.png')});
  await alice.locator('.pinned-meta').getByRole('button',{name:'상단 고정 예시 고정 설정',exact:true}).click();await alice.locator('#pin-mode').selectOption('always');await alice.getByRole('button',{name:'저장하기',exact:true}).click();
  await alice.locator('.pinned-meta').filter({hasText:'항상 고정'}).waitFor();
  await bob.goto(url+'/club?uid=bob&room=lifeup');await bob.locator('.pinned-card').waitFor();assert.equal(await bob.locator('.pinned-meta button').count(),0);
  await alice.getByRole('button',{name:'알림',exact:true}).click();await alice.getByText('알림을 불러오는 중…',{exact:true}).waitFor();
  const before=await alice.locator('.notifications-dialog').boundingBox();
  await alice.getByText('아직 새로운 알림이 없습니다.',{exact:true}).waitFor();
  const after=await alice.locator('.notifications-dialog').boundingBox();assert.equal(before.height,after.height);assert.equal(before.y,after.y);
  for(let i=0;i<12;i++)await db.doc('communityMemberPrivate/alice/notifications/ui-'+i).set({type:'comment',actorId:'bob',postId:'pin-example',postTitle:'상단 고정 예시',message:'지훈님이 댓글을 남겼습니다.',createdAt:clock+i,readAt:null});
  await alice.getByRole('button',{name:'새로고침',exact:true}).click();await alice.locator('.notification-item').first().waitFor();
  assert.equal((await alice.locator('.notifications-dialog').boundingBox()).height,before.height);
  await alice.setViewportSize({width:390,height:844});await alice.screenshot({path:path.join(out,'notifications-stable-mobile.png')});
  assert.ok(await alice.locator('.notification-list').evaluate(el=>el.scrollHeight>el.clientHeight));
  await alice.getByRole('button',{name:'닫기',exact:true}).click();await alice.setViewportSize({width:1440,height:1000});
  await alice.getByRole('button',{name:'채팅',exact:true}).click();await alice.getByRole('button',{name:'새 대화 시작하기'}).click();await alice.locator('.person').filter({hasText:'지훈'}).click();
  await alice.getByLabel('메시지',{exact:true}).fill('지훈님, 반가워요!');await alice.getByRole('button',{name:'보내기',exact:true}).click();
  await alice.locator('.bubble').filter({hasText:'지훈님, 반가워요!'}).waitFor();
  await bob.locator('.chat-unread-dot').waitFor({timeout:15000});await bob.getByRole('button',{name:'채팅',exact:true}).click();await bob.locator('.conversation').filter({hasText:'민지'}).click();
  await bob.locator('.bubble').filter({hasText:'지훈님, 반가워요!'}).waitFor();
  await bob.getByLabel('메시지',{exact:true}).fill('민지님, 저도 반갑습니다.');await bob.getByRole('button',{name:'보내기',exact:true}).click();
  await alice.locator('.bubble').filter({hasText:'민지님, 저도 반갑습니다.'}).waitFor({timeout:15000});
  await alice.screenshot({path:path.join(out,'desktop.png')});await bob.screenshot({path:path.join(out,'mobile.png')});
  assert.ok(await bob.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await bob.getByRole('button',{name:'상대 차단',exact:true}).click();await alice.locator('.blocked-note').waitFor({timeout:15000});assert.ok(await alice.getByLabel('메시지',{exact:true}).isDisabled());
  await bob.getByRole('button',{name:'차단 해제',exact:true}).click();await alice.locator('.blocked-note').waitFor({state:'hidden',timeout:15000});
  await alice.getByRole('button',{name:'내 메시지 삭제',exact:true}).click();await alice.locator('.delete-confirm').getByRole('button',{name:'삭제',exact:true}).click();
  await bob.locator('.bubble.deleted').waitFor({timeout:15000});
  await bob.getByRole('button',{name:'채팅 닫기'}).click();await bob.reload();await bob.getByRole('button',{name:'채팅',exact:true}).click();await bob.locator('.conversation').click();await bob.locator('.bubble.deleted').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: two-member realtime send/reply, unread, deletion, blocking, reload persistence, mobile layout and no browser errors.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
