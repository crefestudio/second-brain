const {test} = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {communityVideoUrl} = require('../lib/community-media-model');
const {normalizeCommunityMedia} = require('../lib/community-media');

test('video links are canonical and restricted to recognized providers', () => {
  for (const url of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']) {
    assert.equal(communityVideoUrl(url), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  }
  assert.equal(communityVideoUrl('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456');
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evil.test', 'http://youtu.be/dQw4w9WgXcQ', '<iframe></iframe>', 'https://user@youtu.be/dQw4w9WgXcQ']) assert.equal(communityVideoUrl(url), null);
});

test('media validates real images, limits, and round trips without changing bytes', async () => {
  const bytes = await sharp({create:{width:800,height:600,channels:3,background:'#4080c0'}}).jpeg().toBuffer();
  const image = {type:'image',src:'data:image/jpeg;base64,' + bytes.toString('base64')};
  const video = {type:'video',src:'https://vimeo.com/123456'};
  const saved = await normalizeCommunityMedia([image,video]);
  assert.deepEqual(await normalizeCommunityMedia(saved), saved);
  assert.equal(saved[0].src, image.src);
  assert.deepEqual(await normalizeCommunityMedia([]), []);
  for (const value of [null, {}, [image,image,image,image], [video,video,video,video], [{type:'image',src:'data:image/jpeg;base64,YmFk'}], [{type:'image',src:'https://example.com/photo.jpg'}], [{type:'video',src:'https://evil.test'}], [{type:'image',src:'x'.repeat(180001)}]]) {
    await assert.rejects(normalizeCommunityMedia(value), error => error.status === 400);
  }
});

test('JPEG color profiles and metadata are normalized instead of rejecting valid photos', async () => {
  const bytes = await sharp({create:{width:800,height:600,channels:3,background:'#4080c0'}})
    .withMetadata({orientation:6}).jpeg().toBuffer();
  assert.ok((await sharp(bytes).metadata()).icc);
  const image = {type:'image',src:'data:image/jpeg;base64,' + bytes.toString('base64')};
  const saved = await normalizeCommunityMedia([image]);
  const meta = await sharp(Buffer.from(saved[0].src.split(',')[1], 'base64')).metadata();
  assert.equal(meta.icc, undefined);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.width, 600);
  assert.equal(meta.height, 800);
  assert.ok(saved[0].src.length <= 180000);
  assert.deepEqual(await normalizeCommunityMedia(saved), saved);
});
