// In-memory only: no Firebase app, emulator, credentials, cleanup or delete API.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createCommunity} = require('../lib/community');
const {createCommunityNotifications} = require('../lib/community-notifications');
const {createCommunityDelivery, canSendCommunityEmail} = require('../lib/community-delivery');
const {communityEventWithdrawn} = require('../lib/community-withdrawal');

const {memoryDb} = require('./helpers/memory-db.cjs');
const alice = {uid: 'alice', name: 'Alice', isAdmin: false};
const bob = {uid: 'bob', name: 'Bob', isAdmin: false};
const admin = {uid: 'admin', name: 'Admin', isAdmin: true};
const post = (authorId, createdAt = 10) => ({authorId, authorName: authorId, title: 'Original title', body: 'Original body',
    roomId: 'hello', kind: 'question', visible: true, version: 1, likes: 0, comments: 1, createdAt, updatedAt: createdAt, acceptedCommentId: null});
function fixture() {
    const memory = memoryDb({
        'communityMembers/alice': {active: true, name: 'Alice', avatar: 'photo', joinedAt: 1},
        'communityMembers/bob': {active: true, name: 'Bob', joinedAt: 1},
        'communityMembers/admin': {active: true, name: 'Admin', joinedAt: 1},
        'communityMemberPrivate/alice': {notificationSettings: {email: true, talk: true, confirmedAt: 1}, unreadCount: 3},
        'communityPosts/alice-post': post('alice'),
        'communityPosts/bob-post': {...post('bob', 20), acceptedCommentId: 'reply'},
        'communityPosts/bob-post/comments/reply': {authorId: 'alice', authorName: 'Alice', body: 'Original reply', createdAt: 20, version: 1, deleted: false},
        'users/workspace': {firebaseUid: 'alice', notionAccessToken: 'unchanged'},
        'appAccounts/alice': {email: 'alice@example.com'},
        'purchases/order': {ownerId: 'alice', paid: true}
    });
    return {...memory, api: createCommunity(memory.db, () => 100, async () => ['admin'])};
}
const withdraw = api => api(alice, {action: 'withdraw', consent: true, confirmation: '클럽 탈퇴', uid: 'bob'});

test('request posts retain their kind, paginate independently, and preserve edit permissions', async () => {
    const f = fixture();
    const api = createCommunity(f.db, () => 100000, async () => ['admin']);
    const input = {action: 'savePost', postId: 'request-new', roomId: 'lifeup', kind: 'request', title: 'Request', body: 'Please help', version: 0};
    assert.equal((await api(alice, input)).post.kind, 'request');
    assert.equal((await api(alice, {...input, title: 'Updated', version: 1})).post.kind, 'request');
    await assert.rejects(api(bob, {...input, version: 2}), e => e.status === 403);
    await assert.rejects(api(alice, {...input, kind: 'invalid', version: 2}), e => e.status === 400);
    for (let i = 0; i < 25; i++) f.rows.set('communityPosts/request-' + i, {...post('bob', 200 + i), kind: 'request', roomId: 'lifeup', comments: 0});
    const first = await api(alice, {action: 'feed', roomId: 'lifeup', kind: 'request'});
    const second = await api(alice, {action: 'feed', roomId: 'lifeup', kind: 'request', cursor: first.nextCursor});
    assert.equal(first.posts.length, 20);
    assert.equal(second.posts.length, 6);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.posts, ...second.posts].map(p => p.id)).size, 26);
    assert.ok([...first.posts, ...second.posts].every(p => p.kind === 'request'));
    assert.equal((await api(alice, {action: 'feed', kind: 'feed'})).posts.length, 0);
    const g = fixture();
    const requestApi = createCommunity(g.db, () => 100000, async () => ['admin']);
    assert.equal((await requestApi(alice, {...input, roomId: 'widgets'})).post.kind, 'request');
    await assert.rejects(requestApi(alice, {...input, postId: 'admin-request', roomId: 'announcements'}), e => e.status === 403);
});

test('withdrawal requires authentication and explicit consent, writes only community state and a review request', async () => {
    const f = fixture(); const before = structuredClone(Object.fromEntries(f.rows));
    await assert.rejects(f.api({...alice, uid: ''}, {action: 'withdraw'}), e => e.status === 401);
    await assert.rejects(f.api(alice, {action: 'withdraw', consent: true}), e => e.status === 400);
    await assert.rejects(f.api({...alice, uid: 'stranger'}, {action: 'withdraw', consent: true, confirmation: '클럽 탈퇴'}), e => e.status === 403);
    assert.equal(f.writes.length, 0);
    await withdraw(f.api);
    assert.deepEqual(f.writes.sort(), ['communityMemberPrivate/alice', 'communityMembers/alice', 'communityWithdrawalRequests/alice']);
    assert.equal(f.rows.get('communityMembers/alice').active, false);
    assert.equal(f.rows.get('communityWithdrawalRequests/alice').status, 'pending_manual_review');
    assert.equal(f.rows.get('communityWithdrawalRequests/alice').scope, 'community-only');
    assert.equal(f.rows.get('communityMemberPrivate/alice').notificationSettings.email, false);
    for (const path of Object.keys(before).filter(p => !['communityMembers/alice', 'communityMemberPrivate/alice'].includes(p))) assert.deepEqual(f.rows.get(path), before[path], path);
    const written = f.writes.length; await withdraw(f.api); assert.equal(f.writes.length, written, 'retry must be idempotent');
});

test('withdrawn membership cannot read, write, change consent or rejoin; state survives reload', async () => {
    const f = fixture(); await withdraw(f.api);
    const state = await f.api(alice, {action: 'state'});
    assert.equal(state.member, null); assert.equal(state.withdrawalStatus, 'pending'); assert.equal(state.unreadCount, 0);
    for (const action of ['feed', 'post', 'members', 'savePost', 'saveComment', 'notificationSettings']) {
        await assert.rejects(f.api(alice, {action, postId: 'bob-post', email: true, talk: true}), e => e.status === 403);
    }
    await assert.rejects(f.api(alice, {action: 'join', consent: true, name: 'Again'}), e => e.status === 409);
});

test('posts disappear from feeds, unread counts, direct links and member lists, including for administrators', async () => {
    const f = fixture(); await withdraw(f.api);
    for (const who of [bob, admin]) {
        assert.deepEqual((await f.api(who, {action: 'feed'})).posts.map(p => p.id), ['bob-post']);
        assert.equal((await f.api(who, {action: 'members'})).members.some(m => m.id === 'alice'), false);
        await assert.rejects(f.api(who, {action: 'post', postId: 'alice-post'}), e => e.status === 404);
    }
    assert.equal((await f.api(bob, {action: 'roomUnreadCounts'})).counts.hello, 0);
    assert.equal((await f.api(admin, {action: 'roomUnreadCounts'})).counts.hello, 1);
    const detail = await f.api(bob, {action: 'post', postId: 'bob-post'});
    assert.equal(detail.accepted, null);
    assert.equal(detail.post.acceptedCommentId, null);
    assert.equal(detail.comments[0].body, ''); assert.equal(detail.comments[0].deleted, true);
    assert.equal(detail.comments[0].authorId, ''); assert.equal(detail.comments[0].authorName, '탈퇴한 멤버');
    assert.equal(f.rows.get('communityPosts/bob-post/comments/reply').body, 'Original reply', 'stored content is preserved for review');
    await assert.rejects(f.api(bob, {action: 'accept', postId: 'bob-post', commentId: 'reply', accepted: true}), e => e.status === 404);
    f.rows.set('communityPosts/bob-post/comments/previously-removed', {authorId: 'alice', authorName: 'Alice', body: '', createdAt: 19, version: 2, deleted: true});
    const refreshed = await f.api(bob, {action: 'post', postId: 'bob-post'});
    assert.ok(refreshed.comments.every(c => c.authorId === '' && c.authorName === '탈퇴한 멤버'));
});

test('filtered feed pages fill beyond withdrawn posts without skipping remaining visible posts', async () => {
    const f = fixture();
    for (let i = 0; i < 45; i++) f.rows.set('communityPosts/hidden-' + i, post('alice', 1000 + i));
    for (let i = 0; i < 25; i++) f.rows.set('communityPosts/visible-' + i, post('bob', 100 + i));
    await withdraw(f.api);
    const first = await f.api(bob, {action: 'feed'}), second = await f.api(bob, {action: 'feed', cursor: first.nextCursor});
    assert.equal(first.posts.length, 20); assert.equal(second.posts.length, 6); assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.posts, ...second.posts].map(p => p.id)).size, 26);
});

test('withdrawn content is suppressed in existing inboxes and pending fanout, without erasing stored notifications', async () => {
    const f = fixture(); const event = {type: 'comment', actorId: 'alice', actorName: 'Alice', postId: 'bob-post', postTitle: 'Original title', recipientId: 'bob', createdAt: 20};
    f.rows.set('communityNotificationEvents/event', event);
    f.rows.set('communityMemberPrivate/bob/notifications/old', {...event, message: 'Alice replied'});
    await withdraw(f.api);
    const notifications = createCommunityNotifications(f.db, () => 100);
    await notifications.fanout('event');
    assert.equal(f.rows.has('communityMemberPrivate/bob/notifications/event'), false);
    assert.equal((await notifications.list('bob')).items.length, 0);
    assert.equal(f.rows.get('communityMemberPrivate/bob/notifications/old').message, 'Alice replied');
    assert.equal(await communityEventWithdrawn(f.db, {postId: 'alice-post'}), true);
});

test('delivery and recipient email gates stop after withdrawal without calling providers', async () => {
    const f = fixture();
    f.rows.set('communityMemberPrivate/bob', {notificationSettings: {email: true, talk: true, confirmedAt: 1}});
    f.rows.set('communityMemberPrivate/bob/notifications/event', {type: 'admin-post', actorId: 'alice', postId: 'alice-post', createdAt: 20, newsletter: {title: 'secret', body: 'secret'}});
    await withdraw(f.api);
    const unexpected = async () => { assert.fail('external provider must not be called'); };
    assert.equal(await canSendCommunityEmail(f.db, {getUser: unexpected}, 'alice', 'alice@example.com'), false);
    const delivery = createCommunityDelivery(f.db, {getUser: unexpected}, unexpected, {ready: () => true, send: unexpected}, () => 100);
    await delivery.deliver('bob', 'event');
    assert.equal(f.rows.get('communityMemberPrivate/bob/notifications/event')['delivery.email'], 'skipped');
});
