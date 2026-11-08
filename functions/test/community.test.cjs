// FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 node --test functions/test/community.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createCommunity } = require('../lib/community');
const { COMMUNITY_ROOMS } = require('../lib/community-model');

test('community Firestore paths deny direct browser reads and writes', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):/);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'member', user_id: 'member', aud: 'demo-community', iss: 'https://securetoken.google.com/demo-community', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'google.com', identities: {} } })}.`;
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-community/databases/(default)/documents`;
  for (const path of ['communityMembers/member', 'communityPosts/post', 'communityPosts/post/comments/reply', 'communityMemberPrivate/member']) {
    for (const method of ['GET', 'PATCH']) {
      const r = await fetch(`${base}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(method === 'PATCH' ? { body: JSON.stringify({ fields: { active: { booleanValue: true } } }) } : {}) });
      assert.equal(r.status, 403, `${method} ${path}`);
    }
  }
});

test('community membership, permissions, reconciliation and pagination', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):/);
  const app = initializeApp({ projectId: 'demo-community-test' }, 'community-test');
  const db = getFirestore(app);
  let clock = 1800000000000;
  const api = createCommunity(db, () => clock, async () => [admin.uid]);
  const a = { uid: 'alice', name: 'Alice', isAdmin: false }, b = { uid: 'bob', name: 'Bob', isAdmin: false }, admin = { uid: 'admin', name: 'Admin', isAdmin: true };
  const post = (postId, extra = {}) => ({ action: 'savePost', postId, roomId: 'hello', kind: 'feed', title: 'Hello', body: 'Welcome', version: 0, ...extra });
  const denied = (task, code) => assert.rejects(task, e => e.status === code);
  for (const path of ['communityPosts', 'communityMembers', 'communityMemberPrivate', 'communityNotificationEvents']) await db.recursiveDelete(db.collection(path));
  try {
    await t.test('nonmembers cannot read posts, comments or member lists; join requires explicit consent', async () => {
      assert.equal((await api(a, { action: 'state' })).member, null);
      for (const action of ['feed', 'post', 'members', 'savePost', 'like']) await denied(api(a, { action, postId: 'p' }), 403);
      await denied(api(a, { action: 'join', name: 'Alice' }), 400);
      await denied(api({ ...a, uid: '' }, { action: 'state' }), 401);
      await denied(api(a, { action: 'join', name: ' ', consent: true }), 400);
    });
    await t.test('joining is idempotent, no privilege/profile fields are accepted', async () => {
      await Promise.all([api(a, { action: 'join', consent: true, name: 'Alice', isAdmin: true }), api(a, { action: 'join', consent: true, name: 'Alice' })]);
      const before = (await api(a, { action: 'state' })).member;
      clock += 20000;
      await api(a, { action: 'join', consent: true, name: 'Changed' });
      assert.deepEqual((await api(a, { action: 'state' })).member, before);
      assert.equal((await api(a, { action: 'state' })).isAdmin, false);
      for (const user of [b, admin]) await api(user, { action: 'join', name: user.name, consent: true });
      await db.collection('communityMembers').doc('blocked').set({ active: false, blocked: true });
      await denied(api({ ...a, uid: 'blocked' }, { action: 'join', name: 'Blocked', consent: true }), 403);
    });
    await t.test('member cannot post to operator rooms, invalid IDs and oversized content fail', async () => {
      await denied(api(a, post('p', { roomId: 'announcements' })), 403);
      await denied(api(a, post('../bad')), 400);
      await denied(api(a, post('p', { body: 'x'.repeat(12001) })), 400);
      await denied(api(a, post('p', { roomId: 'missing' })), 400);
      await api(admin, post('announcement', { roomId: 'announcements' }));
      assert.equal(COMMUNITY_ROOMS.length, 16);
      assert.equal((await api(a,{action:'post',postId:'announcement'})).post.authorIsAdmin,true);
      assert.equal((await api(a,{action:'members'})).members.find(m=>m.id==='admin').isAdmin,true);
    });
    await t.test('room formats are enforced for both members and admins; retired rooms cannot be used', async () => {
      await denied(api(a, post('removed', {roomId:'guides'})), 400);
      for (const r of COMMUNITY_ROOMS) {
        clock += 20000;
        const user = r.adminOnly ? admin : a;
        const result = await api(user, post('format-' + r.id, {roomId:r.id,kind:r.kind === 'question' ? 'feed' : 'question'}));
        assert.equal(result.post.kind, r.kind === 'both' ? 'question' : r.kind);
        await api(user, {action:'deletePost',postId:result.post.id,version:1});
      }
      clock += 20000;
    });
    await t.test('concurrent identical creation and lost-response retries produce one post', async () => {
      const results = await Promise.all([api(a, post('p')), api(a, post('p'))]);
      assert.equal(results[0].post.id, results[1].post.id);
      assert.equal((await db.collection('communityPosts').doc('p').get()).get('version'), 1);
      await denied(api(b, post('p')), 403);
      await denied(api(a, post('spam')), 429);
    });
    await t.test('author editing preserves identity; foreign/stale edits are rejected', async () => {
      await denied(api(b, post('p', { title: 'Tampered', version: 1 })), 403);
      const edited = await api(a, post('p', { title: 'Updated', version: 1 }));
      assert.equal(edited.post.version, 2);
      await denied(api(a, post('p', { title: 'Stale', version: 1 })), 409);
      assert.equal((await api(a, { action: 'post', postId: 'p' })).post.title, 'Updated');
    });
    await t.test('like writes are idempotent and concurrent counts stay accurate', async () => {
      await Promise.all([api(a, { action: 'like', postId: 'p', liked: true }), api(a, { action: 'like', postId: 'p', liked: true }), api(b, { action: 'like', postId: 'p', liked: true })]);
      assert.equal((await api(a, { action: 'post', postId: 'p' })).post.likes, 2);
      await api(a, { action: 'like', postId: 'p', liked: false });
      const p = (await api(a, { action: 'post', postId: 'p' })).post;
      assert.equal(p.likes, 1); assert.equal(p.liked, false);
    });
    await t.test('questions force question format; comments are idempotent and only question author accepts', async () => {
      clock += 20000;
      assert.equal((await api(a, post('q', { roomId: 'questions' }))).post.kind, 'question');
      const reply = { action: 'saveComment', postId: 'q', commentId: 'answer', body: 'Try this', version: 0 };
      await Promise.all([api(b, reply), api(b, reply)]);
      assert.equal((await api(a, { action: 'post', postId: 'q' })).post.comments, 1);
      await denied(api(b, { action: 'accept', postId: 'q', commentId: 'answer', accepted: true }), 403);
      await api(a, { action: 'accept', postId: 'q', commentId: 'answer', accepted: true });
      assert.equal((await api(a, { action: 'post', postId: 'q' })).accepted.id, 'answer');
      await denied(api(a, { ...reply, body: 'Hijack', version: 1 }), 403);
      await api(b, { ...reply, body: 'Edited answer', version: 1 });
      assert.equal((await api(a, { action: 'post', postId: 'q' })).post.acceptedCommentId, null);
      await api(a, { action: 'accept', postId: 'q', commentId: 'answer', accepted: true });
      await api(b, { action: 'deleteComment', postId: 'q', commentId: 'answer', version: 2 });
      const after = await api(a, { action: 'post', postId: 'q' });
      assert.equal(after.post.comments, 0); assert.equal(after.accepted, null); assert.equal(after.comments[0].body, '');
      await denied(api(a, { action: 'accept', postId: 'q', commentId: 'answer', accepted: true }), 400);
    });
    await t.test('all feed includes greetings and questions; room/type filters work', async () => {
      const all = await api(a, { action: 'feed' });
      assert.ok(all.posts.some(p => p.roomId === 'hello')); assert.ok(all.posts.some(p => p.roomId === 'questions'));
      assert.deepEqual((await api(a, { action: 'feed', roomId: 'questions' })).posts.map(p => p.id), ['q']);
      assert.deepEqual((await api(a, { action: 'feed', kind: 'question' })).posts.map(p => p.id), ['q']);
      assert.equal((await api(a, { action: 'feed', roomId: 'questions', kind: 'feed' })).posts.length, 0);
    });
    await t.test('stable cursor handles tied timestamps without missing or repeating records', async () => {
      const batch = db.batch();
      const template = (await db.collection('communityPosts').doc('p').get()).data();
      for (let i = 0; i < 45; i++) batch.set(db.collection('communityPosts').doc('page-' + String(i).padStart(2, '0')), { ...template, createdAt: clock + 100, roomId: 'gtd' });
      await batch.commit();
      const ids = []; let cursor = null;
      do { const page = await api(a, { action: 'feed', roomId: 'gtd', cursor }); ids.push(...page.posts.map(p => p.id)); cursor = page.nextCursor; } while (cursor);
      assert.equal(ids.length, 45); assert.equal(new Set(ids).size, 45);
      await denied(api(a, { action: 'feed', cursor: [NaN, 'x'] }), 400);
    });
    await t.test('profiles expose only public fields and server-derived administrator role', async () => {
      await api(a, { action: 'profile', name: 'New Alice', bio: 'Notion fan', isAdmin: true });
      await db.collection('communityMembers').doc(a.uid).update({ email: 'private@example.test', secret: 'private' });
      const list = await api(b, { action: 'members' });
      assert.equal(list.members.length, 3);
      assert.equal(list.members.find(m=>m.id===a.uid).isAdmin,false);
      assert.deepEqual(Object.keys(list.members.find(m => m.id === a.uid)).sort(), ['bio', 'id', 'isAdmin', 'joinedAt', 'name']);
    });
    await t.test('deletion requires author/operator and blocks all subsequent access/mutation', async () => {
      await denied(api(b, { action: 'deletePost', postId: 'p', version: 2 }), 403);
      const edited = await api(admin, post('p',{title:'Moderated',version:2}));
      assert.equal(edited.post.authorId,a.uid);
      assert.equal(edited.post.authorIsAdmin,false);
      await api(admin, { action: 'deletePost', postId: 'p', version: 3 });
      await denied(api(a, { action: 'post', postId: 'p' }), 404);
      await denied(api(a, { action: 'like', postId: 'p', liked: true }), 404);
      await denied(api(a, { action: 'saveComment', postId: 'p', commentId: 'orphan', body: 'Hidden', version: 0 }), 404);
      assert.equal((await api(a, { action: 'feed', roomId: 'hello' })).posts.length, 0);
      await db.collection('communityMembers').doc(b.uid).update({ active: false });
      await denied(api(b, { action: 'post', postId: 'q' }), 403);
    });
  } finally { await db.terminate(); await deleteApp(app); }
});
