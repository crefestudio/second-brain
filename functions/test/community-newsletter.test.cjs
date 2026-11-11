const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {memoryDb}=require('./helpers/memory-db.cjs');
const {createCommunity}=require('../lib/community');
const {createCommunityNotifications}=require('../lib/community-notifications');
const {createCommunityDelivery,canSendCommunityEmail}=require('../lib/community-delivery');
const {renderCommunityNewsletter,newsletterExcerpt}=require('../lib/community-newsletter');
function fixture(){
 let clock=1800000000000;
 const seed={};
 for(const uid of ['admin','author','reader','blocked','optedout']){
  seed['communityMembers/'+uid]={active:true,name:uid,joinedAt:1};
  seed['communityMemberPrivate/'+uid]={notificationSettings:{email:uid!=='optedout',talk:true,confirmedAt:1}};
 }
 seed['communityPosts/example']={title:'제목',body:'본문 '.repeat(500),roomId:'hello',kind:'feed',authorId:'author',authorName:'원작자',visible:true,isPrivate:false,version:1,createdAt:1700000000000};
 seed['marketingBlocks/'+createHash('sha256').update('email:blocked@example.test').digest('hex')]={email:'blocked@example.test'};
 const f=memoryDb(seed),api=createCommunity(f.db,()=>clock);
 const auth={getUser:async uid=>({email:uid+'@example.test',emailVerified:true,disabled:false})};
 return {...f,auth,call:(uid,input)=>api({uid,name:uid,isAdmin:uid==='admin'},input),tick:()=>clock+=300001,now:()=>clock};
}
const send={action:'sendNewsletter',postId:'example',version:1,requestId:'request-one'};
test('rich newsletter preserves paragraph spacing, empty lines, hard breaks, emphasis and snapshot',async()=>{
 const f=fixture();
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'첫 문단',marks:[{type:'bold'}]},{type:'hardBreak'},{type:'text',text:'다음 줄'}]},{type:'paragraph'},{type:'paragraph',content:[{type:'text',text:'마지막 문단'}]}]};
 f.rows.get('communityPosts/example').bodyDocument=doc;
 await f.call('admin',send);
 const event=[...f.rows.entries()].find(([key])=>key.startsWith('communityNotificationEvents/'))[1];
 assert.deepEqual(event.newsletter.bodyDocument,doc);
 const mail=renderCommunityNewsletter('제목','fallback','https://club.notionable.net/',undefined,event.newsletter.bodyDocument);
 assert.match(mail.html,/<strong>첫 문단<\/strong><br>다음 줄<\/p><p[^>]*><br><\/p><p[^>]*>마지막 문단/);
 assert.match(mail.html,/margin:0 0 16px/);
 assert.match(mail.text,/첫 문단\n다음 줄\n\n\n마지막 문단/);
 const plain=renderCommunityNewsletter('제목','one\n\n\n\ntwo','https://club.notionable.net/');
 assert.match(plain.html,/one<br><br><br><br>two/);
});
test('manual newsletter permits admin/public only, prevents retries, cooldown and stale previews',async()=>{
 const f=fixture();
 await assert.rejects(f.call('reader',send),e=>e.status===403);
 await assert.rejects(f.call('admin',{...send,version:0}),e=>e.status===409);
 f.rows.get('communityPosts/example').isPrivate=true;
 await assert.rejects(f.call('admin',send),e=>e.status===400);
 f.rows.get('communityPosts/example').isPrivate=false;
 await f.call('admin',send);await f.call('admin',send);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('communityNotificationEvents/')).length,1);
 assert.equal(f.rows.get('communityPosts/example').version,1);
 await assert.rejects(f.call('admin',{...send,requestId:'request-two'}),e=>e.status===429);
 f.tick();await f.call('admin',{...send,requestId:'request-two'});
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('communityNotificationEvents/')).length,2);
});
test('fanout uses existing queue, includes opted-in sender, suppresses Kakao and honors global block',async()=>{
 const f=fixture();await f.call('admin',send);
 const eventId=[...f.rows.keys()].find(k=>k.startsWith('communityNotificationEvents/')).split('/')[1];
 await createCommunityNotifications(f.db,f.now).fanout(eventId);
 const queued=[],talks=[];
 const delivery=createCommunityDelivery(f.db,f.auth,async(uid,email,subject,text,key,html,postId,category)=>{
  if(await canSendCommunityEmail(f.db,f.auth,uid,email,category,postId))queued.push({uid,subject,text,html,key});
 },{ready:()=>true,send:async(...args)=>{talks.push(args);return {status:'sent',taskId:'test'};}},f.now);
 for(const uid of ['admin','author','reader','blocked','optedout'])await delivery.deliver(uid,eventId);
 assert.deepEqual(queued.map(m=>m.uid).sort(),['admin','author','reader']);assert.equal(talks.length,0);
 assert.match(queued[0].html,/원작자/);assert.match(queued[0].html,/인사하기/);assert.match(queued[0].html,/게시일/);assert.doesNotMatch(queued[0].html,/app.notionable.net\/block/);
 const id=createHash('sha256').update('email:reader@example.test').digest('hex');f.rows.set('marketingBlocks/'+id,{});
 assert.equal(await canSendCommunityEmail(f.db,f.auth,'reader','reader@example.test','adminPosts','example'),false);
 f.rows.delete('marketingBlocks/'+id);f.rows.get('communityPosts/example').isPrivate=true;
 assert.equal(await canSendCommunityEmail(f.db,f.auth,'reader','reader@example.test','adminPosts','example'),false);
});
test('excerpt preserves Unicode, escapes content and keeps only club preferences in the footer',()=>{
 assert.equal(Array.from(newsletterExcerpt('🙂'.repeat(710))).length,701);
 const mail=renderCommunityNewsletter('<script>x</script>','<img src=x>\nsecond','https://club.notionable.net/?post=test',{authorName:'작성자',roomName:'노션',publishedAt:1700000000000});
 assert.doesNotMatch(mail.html,/<script>|<img/);assert.match(mail.html,/&lt;img/);
 assert.match(mail.text,/전체 글 읽기/);assert.match(mail.html,/Notionable/);
 assert.match(mail.html,/settings=notifications/);assert.doesNotMatch(mail.html,/전체 알림|전체 수신 차단|app.notionable.net\/block/);assert.doesNotMatch(mail.text,/전체 알림/);
});

test('manual newsletters stay email-only and legacy inbox rows are hidden without losing regular unread counts',async()=>{
 const f=fixture();await f.call('admin',send);const store=createCommunityNotifications(f.db,f.now);
 const eventId=[...f.rows.keys()].find(k=>k.startsWith('communityNotificationEvents/')).split('/')[1];
 await store.fanout(eventId);assert.equal(await store.count('reader'),0);assert.equal((await store.list('reader')).items.length,0);
 const target='communityMemberPrivate/author';f.rows.set(target,{unreadCount:33});
 for(let i=0;i<32;i++)f.rows.set(target+'/notifications/legacy-'+i,{manualNewsletter:true,type:'admin-post',actorId:'admin',postId:'example',createdAt:200+i,readAt:null});
 f.rows.set(target+'/notifications/regular',{type:'admin-post',actorId:'admin',postId:'example',createdAt:100,readAt:null,message:'관리자 새 글'});
 const listed=await store.list('author');assert.equal(listed.unreadCount,1);assert.deepEqual(listed.items.map(r=>r.id),['regular']);
 assert.equal(await store.count('author'),1);await store.read('author','legacy-1');assert.equal(await store.count('author'),1);
});
