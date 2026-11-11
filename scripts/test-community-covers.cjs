// Local UI fixture; no production data or accounts are used.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), ts = require('typescript');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '../tmp/community-ui-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..'), base = path.join(root, 'src/app/components/pages/community');
const out = path.join(root, 'tmp/community-cover-preview');
const {COMMUNITY_ROOMS, isCommunityRoomVisible} = require('../functions/lib/community-model');
const entry = `import 'zone.js'; import '@angular/compiler';
import {Component} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter, RouterOutlet} from '@angular/router';
import {CommunityComponent} from './src/app/components/pages/community/community.component';
import {SocialAuthService} from './src/app/services/social-auth.service';
import {CommunityService} from './src/app/services/community.service';
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],template:'<router-outlet />'}) class Root {}
bootstrapApplication(Root,{providers:[provideRouter([{path:'club',component:CommunityComponent}]),
{provide:SocialAuthService,useValue:{init:async()=>{},account:()=>location.search.includes('guest')?null:({uid:'me',displayName:'Member'})}},
{provide:CommunityService,useValue:{watchChat:()=>()=>{},request:async(action)=>action==='state'?{member:location.search.includes('guest')?null:{id:'me',name:'Member'},notificationSettings:{confirmed:true}}:action==='roomUnreadCounts'?{counts:{}}:action==='feed'?{posts:location.search.includes('kind=request')?[{id:'request-demo',kind:'request',roomId:'lifeup',title:'Request example',body:'Please help',authorId:'me',authorName:'Member',createdAt:100000,version:1,comments:0,likes:0}]:[],nextCursor:null}:{items:[],unreadCount:0}}}]}).catch(console.error);`;
(async () => {
    fs.mkdirSync(out, {recursive:true});
    await esbuild.build({stdin:{contents:entry,loader:'ts',resolveDir:root},bundle:true,target:'es2016',format:'iife',tsconfigRaw:{compilerOptions:{experimentalDecorators:true}},outfile:path.join(out,'app.js'),plugins:[{name:'fixture',setup(build){
        build.onLoad({filter:/community(?:-[\w-]+)?\.component\.ts$/},args=>{
            let source = fs.readFileSync(args.path,'utf8');
            source=source.replace(/templateUrl:\s*'([^']+)',\s*styleUrls:\s*\[([^\]]+)\]/,(_,html,styles)=>'template: '+JSON.stringify(fs.readFileSync(path.join(base,html),'utf8'))+', styles: '+JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m=>fs.readFileSync(path.join(base,m[1]),'utf8'))));
    source=source.replace(/styleUrls:\s*\[([^\]]+)\]/g,(_,styles)=>'styles: '+JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m=>fs.readFileSync(path.join(path.dirname(args.path),m[1]),'utf8'))));
            return {contents:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText,loader:'js',resolveDir:path.dirname(args.path)};
        });
        build.onLoad({filter:/[\\/]services[\\/](social-auth|community)\.service\.ts$/},args=>({contents:args.path.endsWith('social-auth.service.ts')?'export class SocialAuthService {}':"export class CommunityService {} export {COMMUNITY_ROOMS} from '../../../functions/src/community-model';",loader:'ts',resolveDir:path.dirname(args.path)}));
    }}]});
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname.startsWith('/assets/')) {
            const file=path.resolve(root,'src','.'+url.pathname);
            if(!file.startsWith(path.join(root,'src','assets')+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
            res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(file));return;
        }
        res.setHeader('Content-Type',url.pathname==='/app.js'?'application/javascript':'text/html;charset=utf-8');
        res.end(url.pathname==='/app.js'?fs.readFileSync(path.join(out,'app.js')):'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><app-root></app-root><script src="/app.js"></script>');
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await chromium.launch({channel:'msedge',headless:true});
        const page=await browser.newPage({viewport:{width:1440,height:960}}), errors=[];
        page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
        page.on('console',message=>{if(message.type()==='error') console.error(message.text());});
        const origin='http://127.0.0.1:'+server.address().port;
        for(const room of COMMUNITY_ROOMS.filter(r=>isCommunityRoomVisible(r.id))) {
            await page.goto(origin+'/club?room='+room.id);
            console.log('Checking cover: '+room.id);
            await page.locator('community-room-cover .motif').nth(2).waitFor({timeout:10000}).catch(async error=>{console.error((await page.locator('body').innerText()).slice(0,1600));await page.screenshot({path:path.join(out,'failure.png')});throw error;});
            assert.equal(await page.locator('.sidebar button').filter({hasText:/^(위젯|가계부)$/}).count(),2);
            assert.equal(await page.locator('.sidebar button').filter({hasText:/^요청하기$/}).count(),0);
            assert.equal(await page.locator('.feed-tabs button').filter({hasText:/^요청하기$/}).count(), ['lifeup','bizup','kakao','routines','development','widgets','budget'].includes(room.id) ? 1 : 0);
            assert.equal(await page.locator('community-room-cover .motif').count(),24);
            for(const img of await page.locator('community-room-cover img').all()) assert.ok(await img.evaluate(el=>el.complete&&el.naturalWidth>0));
            if(['hello','notion','kakao','secondbrain','about'].includes(room.id)) await page.locator('.room-header').screenshot({path:path.join(out,room.id+'.png')});
        }
        for(const query of ['', '?view=mine', '?room=requests']) {
            await page.goto(origin+'/club'+query);await page.locator('.room-header').waitFor();
            assert.equal(await page.locator('.room-cover .bubble').count(),4);
            assert.equal(await page.locator('community-room-cover').count(),0);
        }
        await page.getByRole('button',{name:'글쓰기',exact:true}).click();
        
        await page.setViewportSize({width:390,height:844});
        await page.goto(origin+'/club?room=kakao');await page.locator('community-room-cover .motif').first().waitFor();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(out,'mobile.png')});
        await page.goto(origin+'/club?room=lifeup&kind=request');
        await page.locator('.request-mark').waitFor();
        assert.equal(await page.locator('.request-mark').innerText(),'A');
        assert.equal(await page.locator('.feed-tabs button').last().innerText(),'요청하기');
        await page.getByRole('button',{name:'글쓰기',exact:true}).click();
        assert.equal(await page.locator('#post-kind').inputValue(),'request');
        assert.ok(await page.locator('.editor-dialog .request-guide').isVisible());
        await page.locator('#post-room').selectOption('notion');
        assert.equal(await page.locator('#post-kind').inputValue(),'feed');
        assert.equal(await page.locator('#post-kind option[value="request"]').count(),0);
        await page.locator('#post-room').selectOption('widgets');
        assert.equal(await page.locator('#post-kind option[value="request"]').count(),1);
        await page.locator('#post-kind').selectOption('request');
        await page.screenshot({path:path.join(out,'request-editor-mobile.png')});
        for(const width of [1440,390]) {
            await page.setViewportSize({width,height:960});
            await page.goto(origin+'/club?guest=1');
            await page.locator('.landing-gifts').waitFor();
            assert.ok(await page.locator('.brand-logo').evaluate(el=>el.complete&&el.naturalWidth>0));
            assert.ok((await page.locator('.join-landing h1').innerText()).includes('노셔너블 클럽에 오신 것을 환영합니다!'));
            assert.equal(await page.locator('.landing-gifts li').count(),3);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            await page.screenshot({path:path.join(out,'club-join-'+width+'.png'),fullPage:true});
        }
        assert.deepEqual(errors,[]);
        console.log('PASS: 16 topic covers; image loading; unchanged all/my covers; hidden rooms and editor choices; mobile overflow; no browser errors.');
    } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
