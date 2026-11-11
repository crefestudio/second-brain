const {test}=require('node:test'),assert=require('node:assert/strict');
const {memoryDb}=require('./helpers/memory-db.cjs');
const {createCommunity}=require('../lib/community');
const {renderBlogArticle,renderBlogIndex,renderBlogSitemap,visibleBlogArticles}=require('../lib/community-blog');
function fixture(){
 const f=memoryDb({
  'communityMembers/admin':{active:true,name:'관리자'},'communityMembers/author':{active:true,name:'작성자'},
  'communityPosts/example':{visible:true,isPrivate:false,title:'테스트 <제목>',body:'첫 줄\n다음 줄',authorId:'author',authorName:'작성자',roomId:'lifeup',version:1,createdAt:1700000000000}
 });let time=1800000000000;
 const api=createCommunity(f.db,()=>++time);
 return {...f,call:(action,version=1,uid='admin')=>api({uid,name:uid,isAdmin:uid==='admin'},{action,postId:'example',version}),visible:async()=>visibleBlogArticles(f.db,(await f.db.collection('communityBlogArticles').get()).docs)};
}
test('website publication is paused until its destination is decided',async()=>{
 const f=fixture();await assert.rejects(f.call('publishWebsite'),e=>e.status===503);assert.equal((await f.visible()).length,0);
});
test('source deletion, privacy, hidden room and withdrawal remove published content from all public reads',async()=>{
 const f=fixture();f.rows.set('communityBlogArticles/example',{...f.rows.get('communityPosts/example'),active:true,bodyDocument:null,media:[],publishedAt:1800000000000,updatedAt:1800000000000,sourceVersion:1});const post=f.rows.get('communityPosts/example');
 for(const [key,value] of [['visible',false],['isPrivate',true],['roomId','requests']]){
  const previous=post[key];post[key]=value;assert.equal((await f.visible()).length,0);post[key]=previous;
 }
 f.rows.get('communityMembers/author').withdrawalStatus='pending';assert.equal((await f.visible()).length,0);
});
test('complete HTML includes readable content, semantic metadata and safely escaped structured data',async()=>{
 const f=fixture();f.rows.set('communityBlogArticles/example',{...f.rows.get('communityPosts/example'),active:true,bodyDocument:null,media:[],publishedAt:1800000000000,updatedAt:1800000000000,sourceVersion:1});const article=(await f.visible())[0],base='https://example.test/blog';
 article.title='</script><script>alert(1)</script>';
 article.bodyDocument={type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:'소제목'}]},{type:'paragraph',content:[{type:'text',text:'첫 문단'},{type:'hardBreak'},{type:'text',text:'줄바꿈'}]}]};
 const html=renderBlogArticle(article,base);assert.match(html,/<!doctype html>/);assert.match(html,/<html lang="ko">/);
 assert.match(html,/<h2>소제목<\/h2>/);assert.match(html,/첫 문단<br>줄바꿈/);assert.match(html,/rel="canonical" href="https:\/\/example.test\/blog\/example"/);
 assert.doesNotMatch(html,/<script>alert/);const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(schema['@type'],'BlogPosting');assert.equal(schema.headline,article.title);assert.equal(schema.author.name,'작성자');
 assert.match(renderBlogIndex([article],base),/href="https:\/\/example.test\/blog\/example"/);
 assert.match(renderBlogSitemap([article],base),/<loc>https:\/\/example.test\/blog\/example<\/loc>/);
 article.bodyDocument=null;assert.match(renderBlogArticle(article,base),/첫 줄<br>다음 줄/);
});
