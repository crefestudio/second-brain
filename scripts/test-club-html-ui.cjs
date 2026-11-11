const fs = require('fs'), path = require('path'), http = require('http'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), ts = require('typescript');
const {chromium} = require('../tmp/community-ui-tools/node_modules/playwright');
const root = path.resolve('.'), out = path.join(root, 'tmp/club-html-preview');
fs.mkdirSync(out, {recursive: true});
const entry = `import 'zone.js'; import '@angular/compiler';
import {Component} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser';
import {CommunityEditorComponent, CommunityDocumentComponent} from './src/app/components/pages/community/community-editor.component';
import {normalizeDocument} from './functions/src/community-document';
@Component({selector:'app-root',standalone:true,imports:[CommunityEditorComponent,CommunityDocumentComponent],template:'@if (open) { <community-editor [document]="saved" (changed)="value=$event" /> } <button (click)="save()">Save</button><button (click)="open=!open">Toggle</button><community-document [document]="saved" />'})
class Root {open=true;saved=null;value=null;save(){this.saved=normalizeDocument(JSON.parse(JSON.stringify(this.value.bodyDocument)));localStorage.setItem('doc',JSON.stringify(this.saved));} constructor(){this.saved=JSON.parse(localStorage.getItem('doc')||'null');}}
bootstrapApplication(Root);`;
(async () => {
    await esbuild.build({stdin:{contents:entry,loader:'ts',resolveDir:root},bundle:true,format:'iife',outfile:path.join(out,'app.js'),plugins:[{name:'angular',setup(build){
        build.onLoad({filter:/community-editor\.component\.ts$/},args=>{
            let source=fs.readFileSync(args.path,'utf8').replace(/styleUrls:\s*\[([^\]]+)\]/g,(_,styles)=>'styles:'+JSON.stringify([...styles.matchAll(/'([^']+)'/g)].map(m=>fs.readFileSync(path.join(path.dirname(args.path),m[1]),'utf8'))));
            return {contents:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2016,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText,loader:'js',resolveDir:path.dirname(args.path)};
        });
    }}],tsconfigRaw:{compilerOptions:{experimentalDecorators:true}}});
    const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?fs.readFileSync(path.join(out,'app.js')):'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><app-root></app-root><script src="/app.js"></script>');});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
        browser=await chromium.launch({channel:'msedge',headless:true});
        const page=await browser.newPage(), errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto('http://127.0.0.1:'+server.address().port);
        await page.getByRole('button',{name:'HTML',exact:true}).click();
        const html=`<div style="max-width:760px;margin:0 auto;padding:28px 20px;background:#ffffff;color:#222222;font-family:Arial,'Malgun Gothic',sans-serif;font-size:16px;line-height:1.8;word-break:keep-all;box-sizing:border-box;">
        <div style="padding:24px;background:#fff9df;border:1px solid #f0e4ab;border-radius:16px;"><div style="margin-bottom:10px;font-size:24px;font-weight:700;line-height:1.5;">📱 라이프봇 채팅방 바로 열기</div><div style="color:#555555;">아이폰 홈 화면에 라이프봇 바로가기를 만들어 보세요.<br>카카오톡에서 대화를 시작하세요.</div></div>
        <div style="padding:24px 4px;border-bottom:1px solid #eeeeee;"><div style="margin-bottom:10px;font-size:19px;font-weight:700;">① 새 단축어 만들기</div><div>아이폰에서 <strong>‘단축어’ 앱</strong>을 실행하세요.</div><div style="margin-top:14px;padding:14px 16px;background:#f5f7fa;border:1px solid #e5e9ef;border-radius:10px;word-break:break-all;"><a href="https://pf.kakao.com/_dICwX/chat" style="color:#2463b9;text-decoration:underline;">라이프봇</a></div></div></div>`;
        await page.getByRole('textbox',{name:'HTML 소스'}).fill(html);
        await page.getByRole('button',{name:'Save',exact:true}).click();
        const verify=async()=>{
            const outer=page.locator('community-document .club-rich-text > div');
            assert.equal(await outer.evaluate(el=>getComputedStyle(el).maxWidth),'760px');
            const card=outer.locator(':scope > div').first();
            assert.deepEqual(await card.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.padding,s.borderRadius,s.borderTopWidth]}),['rgb(255, 249, 223)','24px','16px','1px']);
            assert.equal(await card.locator(':scope > div').first().evaluate(el=>getComputedStyle(el).fontSize),'24px');
            assert.equal(await page.locator('community-document a').getAttribute('href'),'https://pf.kakao.com/_dICwX/chat');
        };
        await verify();
        await page.reload(); await page.locator('community-document a').waitFor(); await verify();
        await page.getByRole('button',{name:'HTML',exact:true}).click();
        const restored = await page.getByRole('textbox',{name:'HTML 소스'}).inputValue();
        assert.match(restored,/background:\s*(#fff9df|rgb\(255, 249, 223\))/);
        await page.getByRole('textbox',{name:'HTML 소스'}).fill(restored + '<p>HTML 수정</p>');
        await page.getByRole('button',{name:'에디터',exact:true}).click();
        await page.locator('.tiptap').click(); await page.keyboard.press('Control+End'); await page.keyboard.insertText(' 수정');
        await page.getByRole('button',{name:'Save',exact:true}).click();await verify();
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(out,'styled-mobile.png'),fullPage:true});
        await page.getByRole('button',{name:'HTML',exact:true}).click();
        await page.getByRole('textbox',{name:'HTML 소스'}).fill('<div onclick="alert(1)" style="background:url(https://evil.test/a);position:fixed;color:red"><script>alert(1)</script><span style="font-size:20px">Safe</span><a href="javascript:alert(1)">bad</a></div>');
        await page.getByRole('button',{name:'Save',exact:true}).click();
        const rendered=await page.locator('community-document').innerHTML();
        assert.doesNotMatch(rendered,/onclick|javascript:|<script|evil\.test|position:/);
        assert.match(rendered,/color:\s*red/);assert.match(rendered,/font-size:\s*20px/);
        const supplied = process.argv[2] ? fs.readFileSync(process.argv[2],'utf8') : '<p>이미지</p><p><img src="https://cdn.imweb.me/upload/S20260512dd3b6fbb435e0/38528f583a8bc.png" style="width:542px"></p><p><img src="https://cdn.imweb.me/upload/S20260512dd3b6fbb435e0/2215719826e20.png" style="width:739px"></p>';
        await page.getByRole('textbox',{name:'HTML 소스'}).fill(supplied);
        await page.getByRole('button',{name:'Save',exact:true}).click();
        assert.equal(await page.locator('community-document img').count(),2);
        await page.reload(); await page.locator('community-document img').first().waitFor();
        assert.equal(await page.locator('.tiptap img[src^="https://"]').count(),2);
        for (const img of await page.locator('community-document img').all()) {
            await img.scrollIntoViewIfNeeded();
            await page.waitForFunction(src=>Array.from(document.querySelectorAll('community-document img')).some(img=>img.src===src && img.complete && img.naturalWidth>0),await img.getAttribute('src'));
            assert.ok(await img.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
        }
        await page.getByRole('button',{name:'HTML',exact:true}).click();
        assert.match(await page.getByRole('textbox',{name:'HTML 소스'}).inputValue(),/38528f583a8bc.png/);
        await page.screenshot({path:path.join(out,'external-images-mobile.png'),fullPage:true});
        assert.deepEqual(errors,[]);
        console.log('PASS HTML styles and external images: source, editor switching, save, reload, visual editing, mobile, actual image loading, unsafe markup removal.');
    } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
