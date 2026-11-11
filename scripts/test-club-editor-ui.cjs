// Real Angular + real chat API + real signal listener; all persistence is local emulator only.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require('../tmp/community-ui-tools/node_modules/playwright');
const req=require('node:module').createRequire(path.resolve('functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
const {createCommunity}=require('../functions/lib/community');
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):/);
const root=path.resolve('.'),out=path.join(root,'tmp/club-editor-preview');fs.mkdirSync(out,{recursive:true});
const projectId='demo-club-editor-ui';
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
  await alice.goto(url+'/club?uid=alice');await bob.goto(url+'/club?uid=bob');
  await alice.getByRole('button',{name:'글쓰기',exact:true}).click();
  await alice.locator('#post-title').fill('마크다운과 임시저장');
  const editor=alice.locator('[contenteditable="true"]');
  await editor.click();await alice.keyboard.type('## ');await alice.keyboard.insertText('더 나은 일상');await alice.keyboard.press('Enter');
  await alice.keyboard.insertText('한글로 작성한 본문입니다.');await alice.keyboard.press('Enter');
  await alice.keyboard.type('**bold** ');await alice.keyboard.press('Enter');await alice.keyboard.type('- ');await alice.keyboard.insertText('목록 하나');
  assert.equal(await editor.locator('h2').innerText(),'더 나은 일상');assert.equal(await editor.locator('strong').innerText(),'bold');assert.equal(await editor.locator('li').count(),1);
  await alice.keyboard.press('Enter');await alice.keyboard.press('Enter');
  await editor.evaluate(el=>{const data=new DataTransfer();data.setData('text/html','<p><em>붙여넣은 문장</em>과 <a href="https://notion.so/">노션 링크</a></p>');data.setData('text/plain','붙여넣은 문장과 노션 링크');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  assert.equal(await editor.locator('em').innerText(),'붙여넣은 문장');assert.equal(await editor.locator('a').getAttribute('href'),'https://notion.so/');
  await alice.screenshot({path:path.join(out,'editor-desktop.png')});
  await alice.locator('.dialog-actions').getByRole('button',{name:'임시저장',exact:true}).click();
  await alice.locator('.draft-banner').waitFor();assert.ok((await alice.locator('community-document h2').innerText()).includes('더 나은 일상'));
  const draftId=new URL(alice.url()).searchParams.get('draft');assert.ok(draftId);
  assert.equal((await db.collection('communityNotificationEvents').get()).size,0);
  assert.equal((await db.doc('communityPosts/'+draftId).get()).exists,false);
  await alice.reload();await alice.locator('.draft-banner').waitFor();
  await bob.goto(url+'/club?uid=bob&view=mine&draft='+draftId);await bob.getByRole('alert').waitFor();
  assert.equal(await bob.locator('community-document').count(),0);
  await alice.locator('.draft-banner').getByRole('button',{name:'수정하기'}).click();
  await alice.locator('[contenteditable="true"]').click();await alice.keyboard.press('Control+End');await alice.keyboard.press('Enter');await alice.keyboard.insertText('다시 열어 수정한 내용');
  await alice.locator('.dialog-actions').getByRole('button',{name:'임시저장',exact:true}).click();await alice.locator('.draft-banner').waitFor();
  await alice.locator('community-document').filter({hasText:'다시 열어 수정한 내용'}).waitFor();
  await alice.locator('.draft-banner').getByRole('button',{name:'수정하기'}).click();
  await alice.locator('.dialog-actions').getByRole('button',{name:'게시하기',exact:true}).click();
  await alice.locator('.post-detail').waitFor();await alice.waitForURL(u=>u.searchParams.get('post')===draftId);
  assert.equal((await db.doc('communityMemberPrivate/alice/drafts/'+draftId).get()).exists,false);
  await bob.goto(url+'/club?uid=bob&post='+draftId);await bob.locator('community-document h2').waitFor();
  assert.equal(await bob.locator('community-document strong').innerText(),'bold');
  assert.ok(await bob.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await bob.screenshot({path:path.join(out,'published-mobile.png')});
  await alice.reload();await alice.locator('.author-tools').getByRole('button',{name:'수정',exact:true}).click();
  assert.equal(await alice.locator('[contenteditable="true"] h2').innerText(),'더 나은 일상');
  assert.equal(await alice.locator('.dialog-actions').getByRole('button',{name:'임시저장',exact:true}).count(),0);
  await alice.locator('.dialog-actions').getByRole('button',{name:'취소',exact:true}).click();
  await bob.goto(url+'/club?uid=bob');await bob.getByRole('button',{name:'글쓰기',exact:true}).click();
  await bob.locator('[contenteditable="true"]').fill('모바일 임시저장');
  await bob.screenshot({path:path.join(out,'editor-mobile.png')});
  assert.ok(await bob.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await bob.locator('.dialog-actions').getByRole('button',{name:'임시저장',exact:true}).click();await bob.locator('.draft-banner').waitFor();
  assert.equal(await bob.locator('.post-detail h2').innerText(),'제목 없는 글');
  await bob.getByRole('button',{name:'임시저장',exact:true}).click();await bob.locator('.post-card .draft-badge').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: real editor markdown shortcuts, Korean text, formatting persistence, owner-only drafts, no prepublication events, reload/edit/publish, mobile and incomplete drafts.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
