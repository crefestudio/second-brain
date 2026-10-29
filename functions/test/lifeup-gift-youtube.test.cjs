const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyGiftComment, LIFEUP_GIFT_VIDEO_ID } = require('../lib/lifeup-gift-youtube');
const comment = (author, text = '신청합니다. 응원합니다!') => ({snippet:{topLevelComment:{id:'comment-1',snippet:{authorChannelId:{value:author},textDisplay:text}}}});
function mock(responses) {
 const calls = [];
 const request = async (url) => {
  calls.push(new URL(url));
  const data = responses.shift();
  if (data instanceof Error) throw data;
  return {ok:data?.ok !== false,json:async()=>data};
 };
 return {calls,request};
}
test('matches the resolved channel ID on subsequent pages of the fixed video', async () => {
 const api = mock([{items:[{id:'channel-1'}]}, {items:[comment('someone-else')],nextPageToken:'page2'}, {items:[comment('channel-1')]}]);
 assert.deepEqual(await verifyGiftComment(' @테스트 ', 'key', api.request), {videoId:LIFEUP_GIFT_VIDEO_ID,channelId:'channel-1',commentId:'comment-1'});
 assert.equal(api.calls[0].searchParams.get('forHandle'), '@테스트');
 assert.equal(api.calls[1].searchParams.get('videoId'), '77Upxaer2nA');
 assert.equal(api.calls[1].searchParams.has('searchTerms'), false);
 assert.equal(api.calls[2].searchParams.get('pageToken'), 'page2');
});
test('rejects nonexistent handles', async () => {
 await assert.rejects(verifyGiftComment('@missing', 'key', mock([{items:[]}]).request), e=>e.status===400);
 await assert.rejects(verifyGiftComment('@missing', 'key', mock([{pageInfo:{totalResults:0}}]).request), e=>e.status===400);
});
test('does not accept another author or a reply only', async () => {
 for (const entry of [comment('someone-else'), { replies: { comments: [comment('channel-1').snippet.topLevelComment] } }]) {
  await assert.rejects(verifyGiftComment('@user','key',mock([{items:[{id:'channel-1'}]},{items:[entry]}]).request),e=>e.status===400);
 }
});
test('accepts a comment without 신청 and a handle without @', async () => {
 const api = mock([{items:[{id:'channel-1'}]}, {items:[comment('channel-1','응원합니다')]}]);
 assert.equal((await verifyGiftComment(' UsEr ','key',api.request)).commentId, 'comment-1');
 assert.equal(api.calls[0].searchParams.get('forHandle'), '@user');
});
test('missing keys, API failures, malformed responses and network errors remain retryable errors', async () => {
 await assert.rejects(verifyGiftComment('@user',undefined,()=>{throw Error('must not call');}), e=>e.status===503);
 for (const response of [{ok:false},{},new Error('network')]) {
  await assert.rejects(verifyGiftComment('@user','key',mock([response]).request),e=>e.status===503);
 }
});
test('does not treat incomplete pagination as missing comment', async () => {
 const api = mock([{items:[{id:'channel-1'}]},{items:[],nextPageToken:'repeat'},{items:[],nextPageToken:'repeat'}]);
 await assert.rejects(verifyGiftComment('@user','key',api.request),e=>e.status===503);
});
