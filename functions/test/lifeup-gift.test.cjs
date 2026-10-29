const { test } = require('node:test');
const assert = require('node:assert/strict');
const { giftApplicationError, isYoutubeCommentHandle, normalizeYoutubeHandle } = require('../lib/lifeup-gift');

test('accepts comment handles including Korean and trims surrounding whitespace', () => {
  for (const handle of ['lifeup', ' 라이프업 ', '@lifeup', ' @라이프업_응원 ', '@user.name-123', '@a']) {
    assert.equal(isYoutubeCommentHandle(handle), true, handle);
  }
});

test('rejects missing handles, display names, URLs, whitespace and unsafe punctuation', () => {
  for (const handle of [undefined, {}, '', '@', '@hello world', 'https://youtube.com/@lifeup', '@@lifeup', '@<script>', '@user.', '@' + 'a'.repeat(101)]) {
    assert.equal(isYoutubeCommentHandle(handle), false, String(handle));
  }
});

test('requires a handle, email and confirmations without marketing consent', () => {
  const valid = { youtubeHandle: '라이프업', email: 'fan@example.com', subscribedAndLiked: true, commented: true };
  assert.equal(giftApplicationError(valid), null);
  for (const overrides of [{ youtubeHandle: '' }, { email: undefined }, { email: '' }, { email: 'a@@b.com' }, { email: {} }, { subscribedAndLiked: false }, { commented: false }, { commented: 'true' }]) {
    assert.equal(typeof giftApplicationError({ ...valid, ...overrides }), 'string');
  }
  assert.equal(typeof giftApplicationError({}), 'string');
});

test('adds exactly one @ and leaves an empty handle empty', () => {
  assert.equal(normalizeYoutubeHandle(' 라이프업 '), '@라이프업');
  assert.equal(normalizeYoutubeHandle(' @lifeup '), '@lifeup');
  assert.equal(normalizeYoutubeHandle(' LiFeUp '), '@lifeup');
  assert.equal(normalizeYoutubeHandle(' @LiFeUp '), '@lifeup');
  assert.equal(normalizeYoutubeHandle(' '), '');
});
