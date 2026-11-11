const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommunity}=require('../lib/community');const {memoryDb}=require('./helpers/memory-db.cjs');
test('popular sidebar ranks positive public likes, fills through hidden records and excludes drafts and withdrawn authors',async()=>{
 const f=memoryDb({'communityMembers/member':{active:true,name:'Member'},'communityMembers/gone':{active:false,withdrawalStatus:'pending'}});
 const api=createCommunity(f.db,()=>100000);const who={uid:'member',isAdmin:false};
 const post=(id,likes,extra={})=>f.rows.set('communityPosts/'+id,{title:id,body:'body',roomId:'hello',kind:'feed',authorId:'member',visible:true,createdAt:1,likes,...extra});
 for(let i=0;i<35;i++)post('private-'+i,999,{isPrivate:true});
 post('removed',900,{visible:false});post('retired',800,{roomId:'requests'});post('withdrawn',700,{authorId:'gone'});
 for(let i=1;i<=8;i++)post('public-'+i,i);
 post('zero',0);f.rows.set('communityMemberPrivate/member/drafts/draft',{title:'draft',likes:1000});
 const result=await api(who,{action:'pins',includePopular:true});
 assert.deepEqual(result.popularPosts.map(p=>p.id),['public-8','public-7','public-6','public-5','public-4']);
 assert.equal((await api(who,{action:'pins',roomId:'hello',includePopular:true})).popularPosts.length,0);
 assert.equal((await api(who,{action:'pins'})).popularPosts.length,0);
 await assert.rejects(api({uid:'outsider',isAdmin:false},{action:'pins',includePopular:true}),e=>e.status===403);
});
