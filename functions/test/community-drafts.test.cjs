const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCommunity}=require('../lib/community');
const {memoryDb}=require('./helpers/memory-db.cjs');
const {normalizeDocument,documentText,documentHtml,plainDocument}=require('../lib/community-document');
function fixture(){let clock=100000;const f=memoryDb(Object.fromEntries(['alice','bob','admin'].map(uid=>['communityMembers/'+uid,{active:true,name:uid,joinedAt:1}])));const api=createCommunity(f.db,()=>clock,async()=>['admin']);return {...f,call:(uid,action,data={})=>api({uid,name:uid,isAdmin:uid==='admin'},{action,...data}),tick:()=>clock+=12000};}
const draft={draftId:'draft-one',revision:0,roomId:'hello',kind:'feed',title:'',body:'',isPrivate:false,media:[]};
test('external images persist through member draft and publication, unsafe sources are rejected',async()=>{
 const f=fixture();
 const src='https://cdn.imweb.me/upload/S20260512dd3b6fbb435e0/38528f583a8bc.png';
 const bodyDocument={type:'doc',content:[{type:'paragraph',content:[{type:'image',attrs:{src,alt:'일정 등록',style:'width:542px'}}]}]};
 await f.call('alice','saveDraft',{...draft,title:'이미지',bodyDocument});
 const loaded=(await f.call('alice','draft',{draftId:draft.draftId})).draft;
 assert.deepEqual(loaded.bodyDocument,bodyDocument);f.tick();
 const {post}=await f.call('alice','savePost',{...draft,title:'이미지',bodyDocument:loaded.bodyDocument,postId:draft.draftId,version:0,draftRevision:1});
 assert.match(documentHtml(post.bodyDocument),/<img src="https:\/\/cdn.imweb.me/);
 assert.equal(documentText(post.bodyDocument),'일정 등록');
 for(const src of ['javascript:alert(1)','data:image/svg+xml,<svg></svg>','https://','https://user:pass@example.com/a.png']) {
  const bad=JSON.parse(JSON.stringify(bodyDocument));bad.content[0].content[0].attrs.src=src;
  assert.throws(()=>normalizeDocument(bad));
 }
});
test('styled HTML survives draft save, reload and publication for members and admins',async()=>{
 for(const uid of ['alice','admin']) {
  const f=fixture();
  const bodyDocument={type:'doc',content:[{type:'htmlContainer',attrs:{style:'max-width:760px;padding:28px 20px'},content:[{type:'htmlParagraph',attrs:{style:'background:#fff9df;border:1px solid #f0e4ab;border-radius:16px'},content:[{type:'text',text:'라이프봇',marks:[{type:'link',attrs:{href:'https://pf.kakao.com/_dICwX/chat',style:'color:#2463b9'}}]}]}]}]};
  await f.call(uid,'saveDraft',{...draft,title:'안내',bodyDocument});
  const loaded=(await f.call(uid,'draft',{draftId:draft.draftId})).draft;
  assert.deepEqual(loaded.bodyDocument,bodyDocument);
  f.tick();
  const {post}=await f.call(uid,'savePost',{...draft,title:'안내',bodyDocument:loaded.bodyDocument,postId:draft.draftId,version:0,draftRevision:1});
  assert.deepEqual(post.bodyDocument,bodyDocument);
  assert.match(documentHtml(post.bodyDocument),/background:#fff9df/);
 }
});
test('style validation rejects executable CSS and attribute injection',()=>{
 const doc=plainDocument('safe');
 doc.content[0].attrs={style:'color:red;position:fixed;background:url(https://evil.test);font-size:expression(alert(1));padding:20px;border:1px solid #eee'};
 assert.equal(normalizeDocument(doc).content[0].attrs.style,'color:red;padding:20px;border:1px solid #eee');
 doc.content[0].attrs.style='font-family:" onmouseover="alert(1)';
 assert.doesNotMatch(documentHtml(doc),/onmouseover/);
});
test('drafts are owner-only, not published or notified, incomplete drafts persist and revisions protect changes',async()=>{
 const f=fixture();const saved=await f.call('alice','saveDraft',draft);assert.equal(saved.draft.revision,1);
 assert.equal((await f.call('alice','drafts')).drafts.length,1);
 for(const uid of ['bob','admin']){
  assert.equal((await f.call(uid,'drafts')).drafts.length,0);
  await assert.rejects(f.call(uid,'draft',{draftId:draft.draftId}),e=>e.status===404);
  await assert.rejects(f.call(uid,'deleteDraft',{draftId:draft.draftId,revision:1}),e=>e.status===409);
 }
 for(const uid of ['alice','bob','admin']){
  assert.equal((await f.call(uid,'feed')).posts.length,0);
  await assert.rejects(f.call(uid,'post',{postId:draft.draftId}),e=>e.status===404);
 }
 assert.equal([...f.rows.keys()].filter(p=>p.startsWith('communityNotificationEvents/')).length,0);
 await assert.rejects(f.call('alice','saveDraft',{...draft,title:'stale'}),e=>e.status===409);
 const updated=await f.call('alice','saveDraft',{...draft,revision:1,title:'changed'});assert.equal(updated.draft.revision,2);
 await assert.rejects(f.call('alice','deleteDraft',{draftId:draft.draftId,revision:1}),e=>e.status===409);
 await f.call('alice','deleteDraft',{draftId:draft.draftId,revision:2});assert.equal((await f.call('alice','drafts')).drafts.length,0);
});
test('publication consumes draft atomically, uses publication date and emits an event once across retries',async()=>{
 const f=fixture();const doc={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Hello'}]},{type:'paragraph',content:[{type:'text',text:'World',marks:[{type:'bold'}]}]}]};
 const data={...draft,title:'Announcement',body:'untrusted plaintext',bodyDocument:doc,roomId:'announcements',sharing:{newsletter:true,kakao:true,instagram:false}};
 await f.call('admin','saveDraft',data);f.tick();
 const payload={...data,postId:draft.draftId,version:0,draftRevision:1};
 await assert.rejects(f.call('admin','savePost',{...payload,draftRevision:2}),e=>e.status===409);
 const {post}=await f.call('admin','savePost',payload);
 assert.equal(post.createdAt,112000);assert.equal(post.body,'Hello\nWorld');assert.deepEqual(post.bodyDocument,doc);
 assert.equal((await f.call('admin','drafts')).drafts.length,0);
 assert.equal((await f.call('bob','feed')).posts.length,1);
 await f.call('admin','savePost',payload);
 assert.equal([...f.rows.keys()].filter(p=>p.startsWith('communityNotificationEvents/')).length,1);
 await assert.rejects(f.call('admin','saveDraft',{...data,revision:1}),e=>e.status===409);
 await assert.rejects(f.call('admin','savePost',{...payload,postId:'missing'}),e=>e.status===409);
});
test('draft permissions, server content validation, pagination and rich text safety',async()=>{
 const f=fixture();await assert.rejects(f.call('alice','saveDraft',{...draft,roomId:'announcements'}),e=>e.status===403);
 await assert.rejects(f.call('alice','saveDraft',{...draft,kind:'request'}),e=>e.status===400);
 for(let i=0;i<23;i++){await f.call('alice','saveDraft',{...draft,draftId:'draft-'+i});f.tick();}
 const first=await f.call('alice','drafts');assert.equal(first.drafts.length,20);
 const second=await f.call('alice','drafts',{cursor:first.nextCursor});assert.equal(second.drafts.length,3);
 assert.equal(new Set([...first.drafts,...second.drafts].map(d=>d.id)).size,23);
 const doc=plainDocument('<img src=x onerror=alert(1)>');assert.equal(documentText(doc),'<img src=x onerror=alert(1)>');assert.ok(documentHtml(doc).includes('&lt;img'));
 for(const bad of [{type:'doc',content:[{type:'script'}]}, {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'bad',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]},plainDocument('x'.repeat(12001))])assert.throws(()=>normalizeDocument(bad));
 f.rows.set('communityMembers/alice',{active:false});await assert.rejects(f.call('alice','drafts'),e=>e.status===403);
});
