const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerGiftApplication, GiftRegistrationConflict } = require('../lib/lifeup-gift-registration');

function fakeDb(initial) {
  let record = initial;
  let queue = Promise.resolve();
  let writes = 0;
  const db = {
    collection(name) {
      assert.equal(name, 'lifeupFreeApplications');
      return { doc(id) { assert.equal(id, 'video_channel'); return { id }; } };
    },
    runTransaction(fn) {
      const result = queue.then(() => fn({
        get: async () => ({ data: () => record }),
        set: (_ref, data) => { record = { ...record, ...data }; writes++; }
      }));
      queue = result.catch(() => {});
      return result;
    }
  };
  return { db, record: () => record, writes: () => writes };
}
const claim = email => ({ email, youtubeHandle: '@Fan', comment: {
  videoId: 'video', channelId: 'channel', commentId: 'comment'
} });

test('first registration records the event; same email can return without changing the original', async () => {
  const store = fakeDb();
  await registerGiftApplication(store.db, claim(' Fan@Example.com '));
  assert.equal(store.record().email, 'fan@example.com');
  assert.equal(store.record().youtubeHandle, '@fan');
  assert.equal(store.record().eventName, '무료6종 댓글 이벤트');
  const original = store.record();
  await registerGiftApplication(store.db, claim('fan@example.com'));
  assert.equal(store.record(), original);
  assert.equal(store.writes(), 1);
});

test('different email is rejected and cannot overwrite the first registration', async () => {
  const store = fakeDb();
  await registerGiftApplication(store.db, claim('first@example.com'));
  const original = store.record();
  await assert.rejects(registerGiftApplication(store.db, claim('other@example.com')), {
    name: 'Error', message: '이미 등록된 아이디 입니다.'
  });
  assert.equal(store.record(), original);
  assert.equal(store.writes(), 1);
});

test('competing claims only bind one email when transactions are serialized', async () => {
  const store = fakeDb();
  const results = await Promise.allSettled([
    registerGiftApplication(store.db, claim('first@example.com')),
    registerGiftApplication(store.db, claim('second@example.com'))
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.ok(results[1].reason instanceof GiftRegistrationConflict);
  assert.equal(store.record().email, 'first@example.com');
  assert.equal(store.writes(), 1);
});

test('legacy record binds its first email and preserves the original participation time', async () => {
  const store = fakeDb({ submittedAt: 'original-time', youtubeHandle: '@fan' });
  await registerGiftApplication(store.db, claim('first@example.com'));
  assert.equal(store.record().submittedAt, 'original-time');
  await assert.rejects(registerGiftApplication(store.db, claim('second@example.com')), GiftRegistrationConflict);
});

test('email is registered for every application and the optional choice controls SMS', async () => {
  const store = fakeDb();
  assert.equal(await registerGiftApplication(store.db, claim('fan@example.com')), undefined);
  assert.equal(store.record().marketingEmailConsent, true);
  assert.equal(store.record().marketingSmsConsent, undefined);
  assert.equal(await registerGiftApplication(store.db, { ...claim('fan@example.com'), marketingConsent: true }), true);
  assert.equal(store.record().marketingSmsConsent, true);
  assert.equal(store.writes(), 2);
  const optedIn = fakeDb();
  assert.equal(await registerGiftApplication(optedIn.db, { ...claim('fan@example.com'), marketingConsent: true }), true);
  assert.equal(optedIn.record().marketingEmailConsent, true);
  assert.equal(optedIn.record().marketingSmsConsent, true);
  assert.equal(optedIn.record().marketingConsentVersion, 2);
  assert.ok(optedIn.record().marketingConsentAt);
  const optedOut = fakeDb();
  assert.equal(await registerGiftApplication(optedOut.db, { ...claim('fan@example.com'), marketingConsent: false }), false);
  assert.equal(optedOut.record().marketingEmailConsent, true);
  assert.equal(optedOut.record().marketingSmsConsent, false);
});
