import { createCommunityNotifications, notificationSettings } from './community-notifications';
import { firestore } from 'firebase-admin';
type Firestore = firestore.Firestore;
type Query = firestore.Query;
type Transaction = firestore.Transaction;
const FieldPath = firestore.FieldPath;
import { COMMUNITY_ROOMS, CommunityPost, CommunityComment } from './community-model';

export class CommunityError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export interface CommunityIdentity { uid: string; name: string; isAdmin: boolean }
type Input = Record<string, unknown>;
const fail = (status: number, message: string): never => { throw new CommunityError(status, message); };
function text(value: unknown, max: number, label: string, optional = false): string {
    if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) return fail(400, `${label}을 확인해주세요. (최대 ${max}자)`);
    return value.trim();
}
function id(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) return fail(400, '잘못된 항목입니다.');
    return value;
}
function cursor(value: unknown): [number, string] | null {
    if (value == null) return null;
    if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0) return fail(400, '목록 위치를 확인해주세요.');
    return [value[0], id(value[1])];
}

export function createCommunity(db: Firestore, now = () => Date.now(), resolveAdminIds: () => Promise<string[]> = async () => []) {
    const notifications = createCommunityNotifications(db, now);
    const members = db.collection('communityMembers');
    const posts = db.collection('communityPosts');
    const privateMembers = db.collection('communityMemberPrivate');
    async function requireMember(uid: string, tx?: Transaction) {
        const ref = members.doc(uid);
        const member = tx ? await tx.get(ref) : await ref.get();
        if (!member.exists || member.data()?.active !== true) return fail(403, '커뮤니티에 먼저 가입해주세요.');
        return member;
    }
    function ensurePost(d: FirebaseFirestore.DocumentSnapshot) {
        if (!d.exists || d.data()?.visible !== true || !COMMUNITY_ROOMS.some(r => r.id === d.data()?.roomId)) fail(404, '글을 찾을 수 없습니다. 삭제되었을 수 있습니다.');
    }
    function owner(authorId: string, who: CommunityIdentity) {
        if (authorId !== who.uid && !who.isAdmin) fail(403, '작성자만 수정하거나 삭제할 수 있습니다.');
    }
    function version(v: unknown, expected: number) {
        if (v !== expected) fail(409, '다른 곳에서 수정된 내용입니다. 새로고침 후 다시 시도해주세요.');
    }
    function room(value: unknown, who: CommunityIdentity) {
        const found = COMMUNITY_ROOMS.find(r => r.id === value);
        if (!found) return fail(400, '방을 선택해주세요.');
        if (found.adminOnly && !who.isAdmin) return fail(403, '운영자만 글을 작성할 수 있는 방입니다.');
        return found;
    }
    async function page(query: Query, input: Input, timeField: string, size: number) {
        const point = cursor(input.cursor);
        let q = query.orderBy(timeField, 'desc').orderBy(FieldPath.documentId(), 'desc');
        if (point) q = q.startAfter(...point);
        const result = await q.limit(size + 1).get();
        const docs = result.docs.slice(0, size);
        const last = docs[docs.length - 1];
        return { docs, nextCursor: result.size > size && last ? [last.get(timeField), last.id] : null };
    }
    return async (who: CommunityIdentity, input: Input): Promise<unknown> => {
        if (!who.uid) return fail(401, '로그인이 필요합니다.');
        const adminIds = new Set(await resolveAdminIds());
        if (who.isAdmin) adminIds.add(who.uid);
        const publicMember = (d: FirebaseFirestore.DocumentSnapshot) => {
            const v = d.data() || {};
            return { id: d.id, name: v.name, bio: v.bio || '', joinedAt: v.joinedAt, isAdmin: adminIds.has(d.id) };
        };
        const publicPost = (d: FirebaseFirestore.DocumentSnapshot): CommunityPost => {
            const v = d.data() || {};
            return { id: d.id, roomId: v.roomId, kind: v.kind, title: v.title, body: v.body,
                authorId: v.authorId, authorName: v.authorName, authorIsAdmin: adminIds.has(v.authorId), createdAt: v.createdAt, updatedAt: v.updatedAt,
                sharing: v.sharing, version: v.version, likes: v.likes, comments: v.comments, acceptedCommentId: v.acceptedCommentId };
        };
        const publicComment = (d: FirebaseFirestore.DocumentSnapshot): CommunityComment => {
            const v = d.data() || {};
            return { id: d.id, body: v.deleted ? '' : v.body, authorId: v.authorId, authorName: v.authorName, authorIsAdmin: adminIds.has(v.authorId),
                createdAt: v.createdAt, updatedAt: v.updatedAt, version: v.version, deleted: !!v.deleted };
        };
        const action = input.action;
        if (action === 'state') {
            const member = await members.doc(who.uid).get();
            const active = member.exists && member.data()?.active === true;
            const privateState = await privateMembers.doc(who.uid).get();
            return { member: active ? publicMember(member) : null, isAdmin: who.isAdmin, rooms: COMMUNITY_ROOMS, notificationSettings: notificationSettings(privateState.data()), unreadCount: privateState.get('unreadCount') || 0, talkAvailable: process.env.COMMUNITY_KAKAO_ENABLED === 'true' && !!process.env.COMMUNITY_KAKAO_BOT_ID };
        }
        if (action === 'join') {
            if (input.consent !== true) return fail(400, '커뮤니티 가입을 확인해주세요.');
            const name = text(input.name, 40, '이름');
            if ((input.emailNotifications !== undefined && typeof input.emailNotifications !== 'boolean') || (input.talkNotifications !== undefined && typeof input.talkNotifications !== 'boolean')) fail(400, '알림 설정을 확인해주세요.');
            await db.runTransaction(async tx => {
                const ref = members.doc(who.uid), previous = await tx.get(ref);
                if (previous.data()?.active === true) return;
                if (previous.data()?.blocked === true) fail(403, '커뮤니티 이용이 제한된 계정입니다.');
                tx.set(ref, { name, bio: '', active: true, joinedAt: now() });
                if (typeof input.emailNotifications === 'boolean' && typeof input.talkNotifications === 'boolean') tx.set(privateMembers.doc(who.uid), { notificationSettings: { email: input.emailNotifications, talk: input.talkNotifications, confirmedAt: now() } }, { merge: true });
            });
            return { member: publicMember(await members.doc(who.uid).get()) };
        }
        await requireMember(who.uid);
        if (action === 'notifications') return notifications.list(who.uid, cursor(input.cursor));
        if (action === 'notificationCount') return { unreadCount: (await privateMembers.doc(who.uid).get()).get('unreadCount') || 0 };
        if (action === 'readNotification') { await notifications.read(who.uid, id(input.notificationId)); return { ok: true }; }
        if (action === 'readAllNotifications') { await notifications.read(who.uid); return { ok: true }; }
        if (action === 'notificationSettings') {
            if (typeof input.email !== 'boolean' || typeof input.talk !== 'boolean') fail(400, '알림 설정을 확인해주세요.');
            await privateMembers.doc(who.uid).set({ notificationSettings: { email: input.email, talk: input.talk, confirmedAt: now() } }, { merge: true });
            return { notificationSettings: notificationSettings((await privateMembers.doc(who.uid).get()).data()) };
        }
        if (action === 'feed') {
            let query: Query = posts.where('visible', '==', true);
            if (input.roomId) {
                if (!COMMUNITY_ROOMS.some(r => r.id === input.roomId)) return fail(400, '방을 확인해주세요.');
                query = query.where('roomId', '==', input.roomId);
            }
            if (input.kind) {
                if (!['feed', 'question'].includes(String(input.kind))) return fail(400, '글 형식을 확인해주세요.');
                query = query.where('kind', '==', input.kind);
            }
            const result = await page(query, input, 'createdAt', 20);
            result.docs = result.docs.filter(d => COMMUNITY_ROOMS.some(r => r.id === d.get('roomId')));
            const likes = result.docs.length ? await db.getAll(...result.docs.map(d => d.ref.collection('likes').doc(who.uid))) : [];
            return { posts: result.docs.map((d, i) => ({ ...publicPost(d), liked: likes[i].exists })), nextCursor: result.nextCursor };
        }
        if (action === 'members') {
            const result = await page(members.where('active', '==', true), input, 'joinedAt', 30);
            return { members: result.docs.map(publicMember), nextCursor: result.nextCursor };
        }
        if (action === 'profile') {
            const name = text(input.name, 40, '이름'), bio = text(input.bio, 160, '소개', true);
            await db.runTransaction(async tx => {
                const m = await requireMember(who.uid, tx);
                tx.update(m.ref, { name, bio });
            });
            return { member: publicMember(await members.doc(who.uid).get()) };
        }
        const postRef = posts.doc(id(input.postId));
        if (action === 'post') {
            const post = await postRef.get(); ensurePost(post);
            const result = await page(postRef.collection('comments'), input, 'createdAt', 30);
            const acceptedId = post.get('acceptedCommentId');
            const accepted = acceptedId ? await postRef.collection('comments').doc(acceptedId).get() : null;
            return { post: { ...publicPost(post), liked: (await postRef.collection('likes').doc(who.uid).get()).exists },
                comments: result.docs.map(publicComment), nextCursor: result.nextCursor,
                accepted: accepted?.exists && !accepted.get('deleted') ? publicComment(accepted) : null };
        }
        if (action === 'savePost') {
            const target = room(input.roomId, who), title = text(input.title, 160, '제목'), body = text(input.body, 12000, '내용');
            if (input.kind !== 'feed' && input.kind !== 'question') return fail(400, '글 형식을 선택해주세요.');
            const kind = target.kind === 'both' ? input.kind : target.kind;
            const sharing = input.sharing as {newsletter?: unknown; kakao?: unknown; instagram?: unknown} | undefined;
            if (sharing !== undefined && (!sharing || typeof sharing !== 'object' || typeof sharing.newsletter !== 'boolean' || typeof sharing.kakao !== 'boolean' || (sharing.instagram !== undefined && typeof sharing.instagram !== 'boolean'))) fail(400, '공유 설정을 확인해주세요.');
            if (sharing && !who.isAdmin && (sharing.newsletter || sharing.kakao || sharing.instagram)) fail(403, '관리자만 외부 공유를 사용할 수 있습니다.');
            const channels = { instagram: sharing?.instagram === true, newsletter: sharing?.newsletter === true, kakao: sharing ? sharing.kakao === true : true };
            await db.runTransaction(async tx => {
                const member = await requireMember(who.uid, tx);
                const existing = await tx.get(postRef);
                const throttle = await tx.get(privateMembers.doc(who.uid));
                if (existing.exists) {
                    ensurePost(existing); owner(existing.get('authorId'), who);
                    // A lost create response can be retried with the same client-generated ID.
                    if (input.version === 0 && existing.get('authorId') === who.uid && existing.get('title') === title && existing.get('body') === body && existing.get('roomId') === target.id && existing.get('kind') === kind) return;
                    version(input.version, existing.get('version'));
                    if (existing.get('comments') > 0 && existing.get('kind') !== kind) fail(409, '답글이 있는 글의 형식은 변경할 수 없습니다.');
                    tx.update(postRef, { roomId: target.id, title, body, kind, updatedAt: now(), version: existing.get('version') + 1 });
                    if (who.uid !== existing.get('authorId')) notifications.record(tx, 'moderate-post:' + postRef.id + ':' + input.version, { type: 'moderated', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: title, recipientId: existing.get('authorId'), createdAt: now() });
                } else {
                    if (input.version !== 0) fail(404, '글이 삭제되었습니다.');
                    if (now() - (throttle.get('lastPostAt') || 0) < 10000) fail(429, '잠시 후 새 글을 작성해주세요.');
                    tx.create(postRef, { roomId: target.id, kind, title, body, authorId: who.uid, authorName: member.get('name'),
                        createdAt: now(), updatedAt: now(), version: 1, likes: 0, comments: 0, acceptedCommentId: null, visible: true, ...(who.isAdmin ? {sharing: channels} : {}) });
                    tx.set(privateMembers.doc(who.uid), { lastPostAt: now() }, { merge: true });
                    if (who.isAdmin) notifications.record(tx, 'admin-post:' + postRef.id, { type: 'admin-post', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: title, createdAt: now(), kakao: channels.kakao, ...(channels.newsletter ? {newsletter: {title, body}} : {}) });
                }
            });
            return { post: publicPost(await postRef.get()) };
        }
        if (action === 'deletePost') {
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const d = await tx.get(postRef); ensurePost(d); owner(d.get('authorId'), who); version(input.version, d.get('version'));
                if (who.uid !== d.get('authorId')) notifications.record(tx, 'moderate-delete:' + postRef.id, { type: 'moderated', actorId: who.uid, actorName: who.name, postId: postRef.id, postTitle: d.get('title'), recipientId: d.get('authorId'), createdAt: now() });
                tx.update(postRef, { visible: false, title: '', body: '', updatedAt: now(), version: d.get('version') + 1 });
            });
            return { ok: true };
        }
        if (action === 'like') {
            if (typeof input.liked !== 'boolean') return fail(400, '공감 상태를 확인해주세요.');
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const post = await tx.get(postRef); ensurePost(post);
                const ref = postRef.collection('likes').doc(who.uid), like = await tx.get(ref);
                if (like.exists === input.liked) return;
                if (input.liked) { tx.create(ref, { createdAt: now() }); notifications.record(tx, 'like:' + postRef.id + ':' + who.uid, { type: 'like', actorId: who.uid, actorName: who.name, postId: postRef.id, postTitle: post.get('title'), recipientId: post.get('authorId'), createdAt: now() }); } else tx.delete(ref);
                tx.update(postRef, { likes: Math.max(0, post.get('likes') + (input.liked ? 1 : -1)) });
            });
            return { liked: input.liked, likes: (await postRef.get()).get('likes') };
        }
        if (['saveComment', 'deleteComment', 'accept'].includes(String(action))) {
            const commentRef = postRef.collection('comments').doc(id(input.commentId));
            await db.runTransaction(async tx => {
                const [member, post, comment, throttle] = await tx.getAll(members.doc(who.uid), postRef, commentRef, privateMembers.doc(who.uid));
                if (!member.exists || member.get('active') !== true) fail(403, '커뮤니티에 먼저 가입해주세요.');
                ensurePost(post);
                if (action === 'accept') {
                    if (who.uid !== post.get('authorId')) fail(403, '질문 작성자만 답변을 채택할 수 있습니다.');
                    if (post.get('kind') !== 'question' || !comment.exists || comment.get('deleted')) fail(400, '채택할 답변을 확인해주세요.');
                    if (typeof input.accepted !== 'boolean') fail(400, '채택 상태를 확인해주세요.');
                    if (input.accepted === false && post.get('acceptedCommentId') !== comment.id) return;
                    tx.update(postRef, { acceptedCommentId: input.accepted ? comment.id : null });
                    if (input.accepted) notifications.record(tx, 'accepted:' + postRef.id + ':' + comment.id, { type: 'accepted', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: post.get('title'), recipientId: comment.get('authorId'), createdAt: now() });
                } else if (action === 'deleteComment') {
                    if (!comment.exists || comment.get('deleted')) fail(404, '답글을 찾을 수 없습니다.');
                    owner(comment.get('authorId'), who); version(input.version, comment.get('version'));
                    if (who.uid !== comment.get('authorId')) notifications.record(tx, 'moderate-comment-delete:' + postRef.id + ':' + comment.id, { type: 'moderated', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: post.get('title'), recipientId: comment.get('authorId'), createdAt: now() });
                    tx.update(commentRef, { body: '', deleted: true, version: comment.get('version') + 1, updatedAt: now() });
                    tx.update(postRef, { comments: Math.max(0, post.get('comments') - 1),
                        acceptedCommentId: post.get('acceptedCommentId') === comment.id ? null : post.get('acceptedCommentId') });
                } else {
                    const body = text(input.body, 6000, '답글');
                    if (comment.exists) {
                        if (comment.get('deleted')) fail(404, '삭제된 답글입니다.');
                        owner(comment.get('authorId'), who);
                        if (input.version === 0 && comment.get('authorId') === who.uid && comment.get('body') === body) return;
                        version(input.version, comment.get('version'));
                        if (who.uid !== comment.get('authorId')) notifications.record(tx, 'moderate-comment:' + postRef.id + ':' + comment.id + ':' + input.version, { type: 'moderated', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: post.get('title'), recipientId: comment.get('authorId'), createdAt: now() });
                        tx.update(commentRef, { body, updatedAt: now(), version: comment.get('version') + 1 });
                        if (post.get('acceptedCommentId') === comment.id) tx.update(postRef, { acceptedCommentId: null });
                    } else {
                        if (input.version !== 0) fail(404, '답글을 찾을 수 없습니다.');
                        if (now() - (throttle.get('lastCommentAt') || 0) < 2000) fail(429, '잠시 후 답글을 작성해주세요.');
                        tx.create(commentRef, { body, authorId: who.uid, authorName: member.get('name'), createdAt: now(), updatedAt: now(), version: 1, deleted: false });
                        tx.update(postRef, { comments: post.get('comments') + 1 });
                        tx.set(privateMembers.doc(who.uid), { lastCommentAt: now() }, { merge: true });
                        notifications.record(tx, 'comment:' + postRef.id + ':' + comment.id, { type: 'comment', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: post.get('title'), recipientId: post.get('authorId'), createdAt: now() });
                    }
                }
            });
            return { ok: true };
        }
        return fail(400, '지원하지 않는 요청입니다.');
    };
}
