// Real Angular component + real community service against local Firestore only.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const functionsRequire = require('node:module').createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { createCommunity } = require('../functions/lib/community');
const { createCommunityNotifications } = require('../functions/lib/community-notifications');
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):/);
const root = path.resolve(__dirname, '..'), base = path.join(root, 'src/app/components/pages/community');
const out = path.join(root, 'tmp/community-preview'); fs.mkdirSync(out, { recursive: true });
const entry = `
import 'zone.js'; import '@angular/compiler';
import { Component } from '@angular/core'; import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { CommunityComponent } from './src/app/components/pages/community/community.component';
import { SocialAuthService } from './src/app/services/social-auth.service';
import { CommunityService } from './src/app/services/community.service';
const account = new URLSearchParams(location.search).has('signedOut') ? null : {uid:'me',displayName:'민지'};
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],template:'<router-outlet />'}) class Root {}
bootstrapApplication(Root,{providers:[provideRouter([{path:'community',component:CommunityComponent},{path:'login',component:Root}]),
{provide:SocialAuthService,useValue:{init:async()=>{},account:()=>account,logout:async()=>{}}},
{provide:CommunityService,useValue:{request:async(action,data={})=>{
 const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,action})});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;
}}}]}).catch(console.error);
`;
(async () => {
  const app = initializeApp({ projectId: 'demo-community-ui' }, 'community-ui');
  const db = getFirestore(app); let now = Date.now(); const service = createCommunity(db, () => now, async () => ['other']);
  let browser, server; let adminMode = false;
  try {
    for (const name of ['communityPosts', 'communityMembers', 'communityMemberPrivate']) await db.recursiveDelete(db.collection(name));
    await db.collection('communityMembers').doc('other').set({ name: '지훈', bio: '일상의 작은 시스템을 만들어요.', active: true, joinedAt: now - 86400000 });
    const data = { visible: true, version: 1, likes: 0, comments: 0, acceptedCommentId: null, createdAt: now, updatedAt: now, authorId: 'other', authorName: '지훈', kind: 'feed' };
    await db.collection('communityPosts').doc('hello-post').set({ ...data, roomId: 'hello', title: '반가워요, 작은 습관부터 시작해보려고 합니다.', body: '여러분은 어떤 계기로 라이프업을 시작하셨나요?\n노션으로 일과 일상을 정리하며 배운 것들을 함께 나누고 싶어요.' });
    await db.collection('communityPosts').doc('guide-post').set({ ...data, createdAt: now - 1000, roomId: 'notion', title: '하루 10분, 나만의 주간 회고 루틴', body: '완벽하게 기록하려는 마음을 내려놓으니 꾸준히 쓸 수 있었어요.\n이번 주에 잘한 일 하나와 다음 주에 바꿔볼 일 하나를 적어보세요.' });
    await db.collection('communityPosts').doc('question-post').set({ ...data, createdAt: now - 2000, authorId: 'me', authorName: '민지', roomId: 'questions', kind: 'question', title: 'GTD의 다음 행동과 프로젝트는 어떻게 구분하시나요?', body: '할 일을 정리하다 보면 프로젝트와 다음 행동의 경계가 헷갈립니다.\n실제로 사용하고 계신 방법이 궁금해요.' });
    await esbuild.build({ stdin: { contents: entry, loader: 'ts', resolveDir: root }, bundle: true, target: 'es2016', format: 'iife', outfile: path.join(out, 'app.js'), tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }, plugins: [{ name: 'community-fixture', setup(build) {
      build.onLoad({ filter: /community(?:-icon)?\.component\.ts$/ }, args => {
        let source = fs.readFileSync(args.path, 'utf8');
        if (args.path.endsWith('community.component.ts')) {
          source = source.replace(/templateUrl: '[^']+', styleUrls: \[([^\]]+)\]/, (_, styles) => 'template: ' + JSON.stringify(fs.readFileSync(path.join(base, 'community.component.html'), 'utf8')) + ', styles: ' + JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m => fs.readFileSync(path.resolve(base, m[1]), 'utf8'))));
        }
        return { contents: ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2016, module: ts.ModuleKind.ESNext, experimentalDecorators: true } }).outputText, loader: 'js', resolveDir: path.dirname(args.path) };
      });
      build.onLoad({ filter: /[\\/]services[\\/](social-auth|community)\.service\.ts$/ }, args => ({ contents: args.path.endsWith('social-auth.service.ts') ? 'export class SocialAuthService {}' : "export class CommunityService {} export {COMMUNITY_ROOMS} from '../../../functions/src/community-model';", loader: 'ts', resolveDir: path.dirname(args.path) }));
    } }] });
    const calls = [];
    server = http.createServer(async (req, res) => {
      if (req.url === '/fonts/PretendardVariable.woff2') { res.setHeader('Content-Type','font/woff2'); res.end(fs.readFileSync(path.join(root,'public/fonts/PretendardVariable.woff2'))); return; }
      if (req.url === '/api') {
        let body = ''; for await (const chunk of req) body += chunk;
        const input = JSON.parse(body); calls.push(input.action); now += 20000;
        res.setHeader('Content-Type', 'application/json');
        try { res.end(JSON.stringify(await service({ uid: 'me', name: '민지', isAdmin: adminMode }, input))); }
        catch (e) { res.statusCode = e.status || 500; res.end(JSON.stringify({ error: e.message })); }
        return;
      }
      res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : 'text/html; charset=utf-8');
      res.end(req.url === '/app.js' ? fs.readFileSync(path.join(out, 'app.js')) : '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style><app-root></app-root><script src="/app.js"></script></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }); const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    page.on('console', m => { if (m.type() === 'error') console.error('Console:', m.text()); });
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url + '/community?signedOut=1');
    try { await page.getByRole('link', { name: '기존 계정으로 로그인' }).waitFor({ timeout: 10000 }); }
    catch (e) { console.error('Page text:', await page.locator('body').innerText()); await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}); throw e; }
    assert.deepEqual(calls, []);
    await page.goto(url + '/community');
    await page.getByRole('dialog').waitFor();
    assert.deepEqual(calls, ['state']);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:path.join(out,'join-dialog.png'),fullPage:true});
    await page.getByRole('button', { name: '나중에', exact: true }).click();
    assert.equal(await page.locator('.post-card').count(), 0);
    await page.getByRole('button', { name: '커뮤니티 가입하기', exact: true }).click();
    assert.equal(await page.getByLabel('기본 알림 메일로 받기',{exact:true}).isChecked(),true);
    assert.equal(await page.getByLabel('중요한 알림 문자 또는 카카오톡으로 받기',{exact:true}).isChecked(),true);
    await page.getByLabel('커뮤니티에서 사용할 이름').fill('민지');
    await page.getByRole('button', { name: '확인하고 가입하기', exact: true }).click();
    await page.locator('.post-card').first().waitFor();
    assert.equal(await page.locator('.post-card').count(), 3);
    assert.equal(await page.locator('.post-card .admin-tag').count(),2);
    assert.equal(await page.locator('.sidebar .room-group').count(), 5);
    assert.equal(await page.locator('.sidebar button.room-button').count(), 17);
    await page.screenshot({ path: path.join(out, 'desktop-feed.png'), fullPage: true });
    await page.getByRole('button',{name:'계정 메뉴',exact:true}).click();
    await page.getByRole('button',{name:'다크 모드',exact:true}).click();
    assert.equal(await page.locator('app-community.community-dark').count(),1);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('community-dark')),false);
    await page.getByRole('button',{name:'계정 메뉴',exact:true}).click();
    await page.screenshot({path:path.join(out,'desktop-dark.png'),fullPage:true});
    await page.reload(); await page.locator('.post-card').first().waitFor();
    assert.equal(await page.locator('app-community.community-dark').count(),1);
    await page.getByRole('button',{name:'계정 메뉴',exact:true}).click();
    await page.getByRole('button',{name:'화이트 모드',exact:true}).click();
    await page.getByRole('button',{name:'계정 메뉴',exact:true}).click();
    await db.collection('communityNotificationEvents').doc('ui-notification').set({type:'comment',actorId:'other',actorName:'지훈',recipientId:'me',postId:'question-post',postTitle:'GTD 질문',createdAt:now});
    await createCommunityNotifications(db,()=>now).fanout('ui-notification');
    await page.getByRole('button',{name:'알림',exact:true}).click();
    await page.locator('.notification-item').waitFor();
    assert.equal(await page.locator('.notification-item.unread').count(),1);
    await page.screenshot({path:path.join(out,'notifications.png'),fullPage:true});
    await page.getByRole('button',{name:'모두 읽음',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.notification-item.unread').length===0);
    await page.getByRole('button',{name:'수신 설정',exact:true}).click();
    await page.getByLabel('기본 알림 메일로 받기',{exact:true}).uncheck();
    await page.getByLabel('중요한 알림 문자 또는 카카오톡으로 받기',{exact:true}).uncheck();
    await page.getByRole('button',{name:'저장하기',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal((await db.collection('communityMemberPrivate').doc('me').get()).get('notificationSettings.email'),false);
    await page.getByRole('button',{name:'알림',exact:true}).click();
    await page.locator('.notification-item').click();
    await page.locator('.post-detail').waitFor();
    await page.getByRole('button',{name:'목록으로',exact:true}).click();
    await page.locator('.feed-tabs').getByRole('button', { name: '질문 답변', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.post-card').length === 1);
    await page.locator('.post-open').click();
    await page.locator('.post-detail').waitFor();
    await page.getByLabel('답변 작성').fill('바로 실행할 수 있는 행동 하나로 작게 나누어보세요.');
    await page.getByRole('button', { name: '등록하기', exact: true }).click();
    await page.getByRole('button', { name: '답변 채택', exact: true }).click();
    await page.locator('.accepted-label').waitFor();
    await page.screenshot({ path: path.join(out, 'question-answer.png'), fullPage: true });
    await page.getByRole('button', { name: '채택 취소', exact: true }).click();
    await page.locator('.accepted-label').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '목록으로', exact: true }).click();
    await page.locator('.sidebar').getByRole('button', { name: '인사하기', exact: true }).click();
    await page.locator('.post-card').waitFor();
    await page.screenshot({path:path.join(out,'room-feed.png'),fullPage:true});
    await page.getByRole('button', { name: '글쓰기', exact: true }).click();
    assert.equal(await page.locator('#post-room option[value="announcements"]').count(), 0);
    await page.getByLabel('제목', { exact: true }).fill('내 첫 인사');
    await page.getByLabel('내용', { exact: true }).fill('<script>alert("safe")</script>\n서로의 경험을 나누고 싶어요.');
    await page.getByRole('button', { name: '게시하기', exact: true }).click();
    await page.locator('.post-detail h2').filter({ hasText: '내 첫 인사' }).waitFor();
    assert.ok((await page.locator('.post-detail .post-body').innerText()).includes('<script>'));
    assert.equal(await page.locator('.post-detail script').count(), 0);
    await page.locator('.post-detail').getByRole('button', { name: '수정', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).fill('수정한 첫 인사');
    await page.getByRole('button', { name: '수정하기', exact: true }).click();
    await page.locator('.post-detail h2').filter({ hasText: '수정한 첫 인사' }).waitFor();
    await page.getByRole('button', { name: '공감 0', exact: true }).click();
    await page.getByRole('button', { name: '공감 1', exact: true }).waitFor();
    await page.locator('.post-detail').getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('button', { name: '삭제하기', exact: true }).click();
    await page.locator('.post-open').filter({ hasText: '반가워요' }).waitFor();
    await page.locator('.top-nav').getByRole('button', { name: '멤버', exact: true }).click();
    await page.locator('.member-card').first().waitFor(); assert.equal(await page.locator('.member-card').count(), 2);
    await page.getByRole('button', { name: '프로필 수정', exact: true }).click();
    await page.getByLabel('한 줄 소개').fill('매일 조금씩 나아지는 일상을 기록합니다.');
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await page.getByText('매일 조금씩 나아지는 일상을 기록합니다.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'members.png'), fullPage: true });
    await page.locator('.top-nav').getByRole('button', { name: '홈', exact: true }).click();
    await page.locator('.post-card').first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, 'mobile-feed.png'), fullPage: true });
    await page.getByRole('button', { name: '방 메뉴 열기', exact: true }).click();
    await page.locator('.sidebar').getByRole('button', { name: '묻고 답하기', exact: true }).click();
    await page.locator('.post-card').waitFor(); assert.equal(await page.locator('.sidebar.open').count(), 0);
    await page.getByRole('button', { name: '글쓰기', exact: true }).click();
    assert.equal(await page.locator('#post-kind').isDisabled(), true);
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    adminMode = true;
    await page.setViewportSize({width:1440,height:1050});
    await page.goto(url + '/community'); await page.locator('.post-card').first().waitFor();
    await page.getByRole('button',{name:'글쓰기',exact:true}).click();
    await page.getByLabel('제목',{exact:true}).fill('라이프업의 새로운 이야기');
    await page.getByLabel('내용',{exact:true}).fill('이번 주 커뮤니티 소식을 함께 나눕니다.');
    await page.getByLabel('이메일 뉴스레터',{exact:true}).check();
    await page.getByLabel('인스타그램 공유 준비',{exact:true}).check();
    await page.screenshot({path:path.join(out,'admin-sharing.png'),fullPage:true});
    await page.getByRole('button',{name:'게시하기',exact:true}).click();
    await page.getByRole('button',{name:'인스타그램 공유 준비',exact:true}).click();
    await page.locator('.instagram-preview').waitFor();
    const image = page.locator('.instagram-preview');
    assert.ok((await image.getAttribute('src')).startsWith('data:image/jpeg;'));
    assert.equal(await image.evaluate(el=>el.naturalWidth),1080);
    assert.ok((await page.getByLabel('캡션',{exact:true}).inputValue()).includes('이번 주 커뮤니티'));
    await page.screenshot({path:path.join(out,'instagram-sharing.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ success: true, screenshots: out, checks: ['guest gate', 'explicit join', '16 rooms', 'all feed', 'question filter', 'answer and acceptance', 'create edit delete', 'safe text rendering', 'likes', 'member profiles', 'mobile navigation and overflow', 'admin share options', 'Instagram JPEG and caption preparation'] }));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await db.terminate(); await deleteApp(app);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
