import { normalizeCommunityMedia } from './community-media';
import {createHash} from 'crypto';
import {normalizeDocument, documentText, ClubDocument} from './community-document';
import {createCommunityDrafts} from './community-drafts';
import { notificationPreferences, notificationSettingsRecord, NotificationPreferences, validNotificationPreferences } from './community-notification-settings';
import { createCommunityChat } from './community-chat';
import { isCommunityWithdrawn, withdrawnCommunityAuthors, requestCommunityWithdrawal } from './community-withdrawal';
import { createCommunityNotifications, notificationSettings } from './community-notifications';
import { normalizeCommunityAvatar } from './community-avatar';
import { firestore } from 'firebase-admin';
type Firestore = firestore.Firestore;
type Query = firestore.Query;
type Transaction = firestore.Transaction;
const FieldPath = firestore.FieldPath;
import { COMMUNITY_ROOMS, isCommunityRoomVisible, supportsCommunityRequests, CommunityPost, CommunityComment } from './community-model';

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
    const chat = createCommunityChat(db, now, fail);
    const drafts = createCommunityDrafts(db, now, fail);
    const notifications = createCommunityNotifications(db, now);
    const members = db.collection('communityMembers');
    const posts = db.collection('communityPosts');
    const privateMembers = db.collection('communityMemberPrivate');
    async function requireMember(uid: string, tx?: Transaction) {
        const ref = members.doc(uid);
        const member = tx ? await tx.get(ref) : await ref.get();
        if (!member.exists || (member.data()?.active !== true || isCommunityWithdrawn(member.data()))) return fail(403, '클럽에 먼저 가입해주세요.');
        return member;
    }
    function canReadPost(d: FirebaseFirestore.DocumentSnapshot, who: CommunityIdentity) {
        return d.get('isPrivate') !== true || who.isAdmin || d.get('authorId') === who.uid;
    }
    async function ensurePost(d: FirebaseFirestore.DocumentSnapshot, who: CommunityIdentity, tx?: Transaction) {
        if ((await withdrawnCommunityAuthors(db, [d.get('authorId') || ''], tx)).size) fail(404, '글을 찾을 수 없습니다.');
        if (!d.exists || d.data()?.visible !== true || !isCommunityRoomVisible(d.data()?.roomId) || !canReadPost(d, who)) fail(404, '글을 찾을 수 없습니다. 삭제되었거나 접근 권한이 없을 수 있습니다.');
    }
    function owner(authorId: string, who: CommunityIdentity) {
        if (authorId !== who.uid && !who.isAdmin) fail(403, '작성자만 수정하거나 삭제할 수 있습니다.');
    }
    function version(v: unknown, expected: number) {
        if (v !== expected) fail(409, '다른 곳에서 수정된 내용입니다. 새로고침 후 다시 시도해주세요.');
    }
    function room(value: unknown, who: CommunityIdentity) {
        const found = COMMUNITY_ROOMS.find(r => r.id === value);
        if (!found || !isCommunityRoomVisible(value)) return fail(400, '방을 선택해주세요.');
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
        const authorAvatars = new Map<string, string>();
        const withdrawnAuthors = new Set<string>();
        async function loadAuthorAvatars(docs: FirebaseFirestore.DocumentSnapshot[]) {
            const ids = [...new Set(docs.filter(d => d.exists).map(d => d.get('authorId') as string))]
                .filter(uid => uid && !authorAvatars.has(uid));
            if (!ids.length) return;
            const authors = await db.getAll(...ids.map(uid => members.doc(uid)), {fieldMask: ['avatar', 'active', 'withdrawalStatus']});
            authors.forEach(d => {
                authorAvatars.set(d.id, d.get('active') === true ? d.get('avatar') || '' : '');
                if (isCommunityWithdrawn(d.data())) withdrawnAuthors.add(d.id);
            });
        }
        const publicMember = (d: FirebaseFirestore.DocumentSnapshot) => {
            const v = d.data() || {};
            return { id: d.id, name: v.name, bio: v.bio || '', joinedAt: v.joinedAt, isAdmin: adminIds.has(d.id), ...(v.avatar ? {avatar: v.avatar} : {}) };
        };
        const publicPost = (d: FirebaseFirestore.DocumentSnapshot): CommunityPost => {
            const v = d.data() || {};
            return { id: d.id, bodyDocument: v.bodyDocument || null, pinCategory: v.pinCategory === 'resource' ? 'resource' : 'post', pinExpiresAt: v.pinExpiresAt || 0, pinnedAt: v.pinnedAt || 0, isPrivate: v.isPrivate === true, roomId: v.roomId, kind: v.kind, title: v.title, body: v.body, media: v.media || [],
                authorId: v.authorId, authorName: v.authorName, authorIsAdmin: adminIds.has(v.authorId), authorAvatar: authorAvatars.get(v.authorId) || '', createdAt: v.createdAt, updatedAt: v.updatedAt,
                websitePublishedAt: v.websitePublishedAt || 0, websitePublishedVersion: v.websitePublishedVersion || 0,
                sharedInstagramUrl: v.sharedInstagramUrl || '', ...(who.isAdmin && (v.sharing?.newsletter || v.newsletterRequestedAt) ? {newsletterSentCount: v.newsletterSentCount || 0, newsletterRequestedAt: v.newsletterRequestedAt || 0} : {}), sharing: v.sharing, version: v.version, likes: v.likes, comments: v.comments, acceptedCommentId: v.acceptedCommentId };
        };
        const publicComment = (d: FirebaseFirestore.DocumentSnapshot): CommunityComment => {
            const v = d.data() || {};
            const hidden = withdrawnAuthors.has(v.authorId);
            return { id: d.id, body: v.deleted || hidden ? '' : v.body, authorId: hidden ? '' : v.authorId, authorName: hidden ? '탈퇴한 멤버' : v.authorName, authorIsAdmin: !hidden && adminIds.has(v.authorId), authorAvatar: v.deleted || hidden ? '' : authorAvatars.get(v.authorId) || '',
                createdAt: v.createdAt, updatedAt: v.updatedAt, version: v.version, deleted: !!v.deleted || hidden };
        };
        const action = input.action;
        if (action === 'state') {
            const member = await members.doc(who.uid).get();
            const active = member.exists && member.data()?.active === true && !isCommunityWithdrawn(member.data());
            const privateState = await privateMembers.doc(who.uid).get();
            return { withdrawalStatus: member.get('withdrawalStatus') || null, member: active ? publicMember(member) : null, isAdmin: who.isAdmin, rooms: COMMUNITY_ROOMS.filter(r => isCommunityRoomVisible(r.id)), allowMemberDm: privateState.get('allowMemberDm') === true, notificationSettings: notificationSettings(privateState.data()), unreadCount: active ? await notifications.count(who.uid) : 0, talkAvailable: process.env.COMMUNITY_KAKAO_ENABLED === 'true' && !!process.env.COMMUNITY_KAKAO_BOT_ID };
        }
        if (action === 'withdraw') {
            if (input.confirmation !== '클럽 탈퇴' || input.consent !== true) fail(400, '탈퇴 안내를 확인해주세요.');
            const result = await requestCommunityWithdrawal(db, who.uid, now);
            if (!result.ok) fail(403, '클럽에 먼저 가입해주세요.');
            return result;
        }
        if (action === 'join') {
            if (input.consent !== true) return fail(400, '클럽 가입을 확인해주세요.');
            const name = text(input.name, 40, '이름');
            if (input.categories !== undefined && !validNotificationPreferences(input.categories)) fail(400, '알림 설정을 확인해주세요.');
            if ((input.emailNotifications !== undefined && typeof input.emailNotifications !== 'boolean') || (input.talkNotifications !== undefined && typeof input.talkNotifications !== 'boolean')) fail(400, '알림 설정을 확인해주세요.');
            await db.runTransaction(async tx => {
                const ref = members.doc(who.uid), previous = await tx.get(ref);
                if (isCommunityWithdrawn(previous.data())) fail(409, '클럽 탈퇴가 처리되었습니다. 데이터 정리 완료 전에는 다시 가입할 수 없습니다.');
                if (previous.data()?.active === true) return;
                if (previous.data()?.blocked === true) fail(403, '클럽 이용이 제한된 계정입니다.');
                tx.set(ref, { name, bio: '', active: true, joinedAt: now() });
                if (input.categories !== undefined || (typeof input.emailNotifications === 'boolean' && typeof input.talkNotifications === 'boolean')) {
                    const categories = input.categories === undefined ? notificationPreferences({email: input.emailNotifications as boolean, talk: input.talkNotifications as boolean}) : input.categories;
                    tx.set(privateMembers.doc(who.uid), {notificationSettings: notificationSettingsRecord(categories as NotificationPreferences, now())}, {mergeFields: ['notificationSettings']});
                }
            });
            return { member: publicMember(await members.doc(who.uid).get()) };
        }
        const activeMember = await requireMember(who.uid);
        async function pinnedRows(roomId?: string) {
            const rows = await posts.where('pinExpiresAt', '>', now()).get();
            const hidden = await withdrawnCommunityAuthors(db, rows.docs.map(d => d.get('authorId')));
            return rows.docs.filter(d => d.get('visible') === true && !d.get('isPrivate') && isCommunityRoomVisible(d.get('roomId')) && !hidden.has(d.get('authorId')) && (!roomId || d.get('roomId') === roomId))
                .sort((a, b) => (b.get('pinnedAt') || 0) - (a.get('pinnedAt') || 0) || b.id.localeCompare(a.id));
        }
        if (action === 'pins') {
            if (input.roomId && !isCommunityRoomVisible(input.roomId)) fail(400, '방을 확인해주세요.');
            const rows = await pinnedRows(input.roomId ? String(input.roomId) : undefined);
            await loadAuthorAvatars(rows);
            const popular: FirebaseFirestore.QueryDocumentSnapshot[] = [];
            if (input.includePopular === true && !input.roomId) {
                let point: unknown = null;
                do {
                    const batch = await page(posts.where('likes', '>', 0), {cursor: point}, 'likes', 30);
                    const hidden = await withdrawnCommunityAuthors(db, batch.docs.map(d => d.get('authorId')));
                    popular.push(...batch.docs.filter(d => d.get('visible') === true && !d.get('isPrivate') && isCommunityRoomVisible(d.get('roomId')) && !hidden.has(d.get('authorId'))));
                    point = batch.nextCursor;
                } while (popular.length < 5 && point);
                popular.splice(5);
                await loadAuthorAvatars(popular);
            }
            return {posts: rows.filter(d => d.get('pinCategory') !== 'resource').map(publicPost), resourcePosts: rows.filter(d => d.get('pinCategory') === 'resource').map(publicPost), popularPosts: popular.map(publicPost)};
        }
        if (['drafts', 'draft', 'saveDraft', 'deleteDraft'].includes(String(action))) return drafts(who, input);
        if (typeof action === 'string' && action.startsWith('chat')) return chat(who, input, adminIds);
        if (action === 'pinPost') {
            if (!who.isAdmin) return fail(403, '관리자만 글을 고정할 수 있습니다.');
            if (!['none', 'always', 'day', 'resource'].includes(String(input.mode))) return fail(400, '고정 옵션을 선택해주세요.');
            const ref = posts.doc(id(input.postId));
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const post = await tx.get(ref);
                await ensurePost(post, who, tx);
                if (post.get('isPrivate')) fail(400, '비공개 글은 고정할 수 없습니다.');
                tx.update(ref, {pinnedAt: now(), pinCategory: input.mode === 'resource' ? 'resource' : 'post', pinExpiresAt: input.mode === 'always' || input.mode === 'resource' ? Number.MAX_SAFE_INTEGER : input.mode === 'day' ? now() + 86400000 : 0});
            });
            const updated = await ref.get(); await loadAuthorAvatars([updated]);
            return {post: publicPost(updated)};
        }
        authorAvatars.set(who.uid, activeMember.get('avatar') || '');
        if (action === 'roomUnreadCounts') {
            const counts: Record<string, number> = Object.fromEntries(COMMUNITY_ROOMS.filter(r => isCommunityRoomVisible(r.id)).map(r => [r.id, 0]));
            let after = '';
            // Project only routing metadata; never fetch every post body to count unread posts.
            for (;;) {
                let query = posts.where('visible', '==', true).orderBy(FieldPath.documentId()).select('roomId', 'authorId', 'createdAt', 'isPrivate').limit(500);
                if (after) query = query.startAfter(after);
                const batch = await query.get();
                const hidden = await withdrawnCommunityAuthors(db, batch.docs.map(p => p.get('authorId')));
                const candidates = batch.docs.filter(p => !hidden.has(p.get('authorId')) && canReadPost(p, who) && p.get('authorId') !== who.uid && p.get('createdAt') >= activeMember.get('joinedAt') && Object.hasOwnProperty.call(counts, p.get('roomId')));
                if (candidates.length) {
                    const read = await db.getAll(...candidates.map(p => privateMembers.doc(who.uid).collection('readPosts').doc(p.id)));
                    candidates.forEach((p, i) => { if (!read[i].exists) counts[p.get('roomId')]++; });
                }
                if (batch.size < 500) break;
                after = batch.docs[batch.size - 1].id;
            }
            return {counts};
        }
        if (action === 'notifications') return notifications.list(who.uid, cursor(input.cursor));
        if (action === 'notificationCount') return { unreadCount: await notifications.count(who.uid) };
        if (action === 'readNotification') { await notifications.read(who.uid, id(input.notificationId)); return { ok: true }; }
        if (action === 'readAllNotifications') { await notifications.read(who.uid); return { ok: true }; }
        if (action === 'notificationSettings') {
            if (input.allowMemberDm !== undefined && typeof input.allowMemberDm !== 'boolean') fail(400, 'DM 수신 설정을 확인해주세요.');
            if (input.categories !== undefined ? !validNotificationPreferences(input.categories) : typeof input.email !== 'boolean' || typeof input.talk !== 'boolean') fail(400, '알림 설정을 확인해주세요.');
            const categories = input.categories === undefined ? notificationPreferences({email: input.email as boolean, talk: input.talk as boolean}) : input.categories;
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                tx.set(privateMembers.doc(who.uid), { notificationSettings: notificationSettingsRecord(categories as NotificationPreferences, now()) }, { mergeFields: ['notificationSettings'] });
                if (typeof input.allowMemberDm === 'boolean') tx.set(privateMembers.doc(who.uid), {allowMemberDm: input.allowMemberDm}, {merge: true});
            });
            return { notificationSettings: notificationSettings((await privateMembers.doc(who.uid).get()).data()) };
        }
        if (action === 'feed') {
            let query: Query = posts.where('visible', '==', true);
            if (input.mine !== undefined && typeof input.mine !== 'boolean') fail(400, '내 글 필터를 확인해주세요.');
            if (input.mine === true) query = query.where('authorId', '==', who.uid);
            if (input.roomId) {
                if (!isCommunityRoomVisible(input.roomId)) return fail(400, '방을 확인해주세요.');
                query = query.where('roomId', '==', input.roomId);
            }
            if (input.kind) {
                if (!['feed', 'question', 'request'].includes(String(input.kind))) return fail(400, '글 형식을 확인해주세요.');
                query = query.where('kind', '==', input.kind);
            }
            let pinned: FirebaseFirestore.QueryDocumentSnapshot[] = [];
            if (input.roomId && input.mine !== true) pinned = (await pinnedRows(String(input.roomId))).filter(d => d.get('pinCategory') !== 'resource' && (!input.kind || d.get('kind') === input.kind));
            const pinnedIds = new Set(pinned.map(d => d.id));
            // Fill a visible page even when intervening posts are pinned, private or retired.
            const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
            let point = input.cursor;
            for (;;) {
                const batch = await page(query, {cursor: point}, 'createdAt', 20);
                const hidden = await withdrawnCommunityAuthors(db, batch.docs.map(d => d.get('authorId')));
                docs.push(...batch.docs.filter(d => !pinnedIds.has(d.id) && !hidden.has(d.get('authorId')) && canReadPost(d, who) && isCommunityRoomVisible(d.get('roomId'))));
                if (docs.length > 20 || !batch.nextCursor) break;
                point = batch.nextCursor;
            }
            const last = docs[19];
            const result = {docs: docs.slice(0, 20), nextCursor: docs.length > 20 ? [last.get('createdAt'), last.id] : null};
            await loadAuthorAvatars([...pinned, ...result.docs]);
            const likes = result.docs.length ? await db.getAll(...result.docs.map(d => d.ref.collection('likes').doc(who.uid))) : [];
            return { pinnedPosts: pinned.map(publicPost), posts: result.docs.map((d, i) => ({ ...publicPost(d), liked: likes[i].exists })), nextCursor: result.nextCursor };
        }
        if (action === 'members') {
            const result = await page(members.where('active', '==', true), input, 'joinedAt', 30);
            return { members: result.docs.filter(d => !isCommunityWithdrawn(d.data())).map(publicMember), nextCursor: result.nextCursor };
        }
        if (action === 'profile') {
            const name = text(input.name, 40, '이름'), bio = text(input.bio, 160, '소개', true);
            let avatar: string | undefined;
            if (input.avatar !== undefined) {
                try { avatar = await normalizeCommunityAvatar(input.avatar); }
                catch { return fail(400, '프로필 사진을 확인해주세요. JPG·PNG·WebP 이미지를 다시 선택해주세요.'); }
            }
            await db.runTransaction(async tx => {
                const m = await requireMember(who.uid, tx);
                tx.update(m.ref, { name, bio, ...(avatar === undefined ? {} : {avatar}) });
            });
            return { member: publicMember(await members.doc(who.uid).get()) };
        }
        const postRef = posts.doc(id(input.postId));
        if (action === 'publishWebsite' || action === 'unpublishWebsite') {
            fail(503, '홈페이지 발행은 준비 중입니다.');
            if (!who.isAdmin) fail(403, '관리자만 홈페이지에 발행할 수 있습니다.');
            const publicationRef = db.collection('communityBlogArticles').doc(postRef.id);
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const [post, previous] = await tx.getAll(postRef, publicationRef);
                await ensurePost(post, who, tx);
                version(input.version, post.get('version'));
                if (post.get('isPrivate')) fail(400, '비공개 글은 홈페이지에 발행할 수 없습니다.');
                if (action === 'unpublishWebsite') {
                    tx.delete(publicationRef);
                    tx.update(postRef, {websitePublishedAt:0, websitePublishedVersion:0});
                    return;
                }
                if (previous.get('active') && previous.get('sourceVersion') === post.get('version')) return;
                const updatedAt = now();
                const publishedAt = previous.get('publishedAt') || updatedAt;
                tx.set(publicationRef, {active:true, title:post.get('title'), body:post.get('body'), bodyDocument:post.get('bodyDocument') || null,
                    media:post.get('media') || [], authorId:post.get('authorId'), authorName:post.get('authorName'), roomId:post.get('roomId'),
                    publishedAt, updatedAt, sourceVersion:post.get('version')});
                tx.update(postRef, {websitePublishedAt:publishedAt, websitePublishedVersion:post.get('version')});
            });
            return {post: publicPost(await postRef.get())};
        }
        if (action === 'sendNewsletter') {
            if (!who.isAdmin) fail(403, '관리자만 뉴스레터를 발송할 수 있습니다.');
            const requestId = id(input.requestId);
            const key = 'newsletter:' + postRef.id + ':' + requestId;
            const eventRef = db.collection('communityNotificationEvents').doc(createHash('sha256').update(key).digest('hex'));
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const [post, prior] = await tx.getAll(postRef, eventRef);
                await ensurePost(post, who, tx);
                if (post.get('isPrivate')) fail(400, '비공개 글은 뉴스레터로 발송할 수 없습니다.');
                if (prior.exists) return;
                version(input.version, post.get('version'));
                if (post.get('newsletterRequestedAt') && now() - post.get('newsletterRequestedAt') < 300000) fail(429, '이미 발송을 요청했습니다. 재발송은 5분 뒤 가능합니다.');
                const roomId = post.get('roomId');
                notifications.record(tx, key, {type:'admin-post', manualNewsletter:true, actorId:who.uid, actorName:activeMember.get('name'), postId:post.id, postTitle:post.get('title'), createdAt:now(), kakao:false,
                    category:roomId === 'announcements' ? 'notices' : roomId === 'events' ? 'events' : 'adminPosts', newsletter:{title:post.get('title'),body:post.get('body'),...(post.get('bodyDocument') ? {bodyDocument:post.get('bodyDocument')} : {})}});
                tx.update(postRef, {newsletterRequestedAt:now()});
            });
            return {ok:true};
        }
        if (action === 'post') {
            const post = await postRef.get(); await ensurePost(post, who);
            const result = await page(postRef.collection('comments'), input, 'createdAt', 30);
            const acceptedId = post.get('acceptedCommentId');
            const accepted = acceptedId ? await postRef.collection('comments').doc(acceptedId).get() : null;
            await loadAuthorAvatars([post, ...result.docs, ...(accepted ? [accepted] : [])]);
            const visibleAccepted = accepted?.exists && !accepted.get('deleted') && !withdrawnAuthors.has(accepted.get('authorId')) ? publicComment(accepted) : null;
            const liked = (await postRef.collection('likes').doc(who.uid).get()).exists;
            await privateMembers.doc(who.uid).collection('readPosts').doc(postRef.id).set({readAt: now()});
            return { post: { ...publicPost(post), liked, acceptedCommentId: visibleAccepted?.id || null },
                comments: result.docs.map(publicComment), nextCursor: result.nextCursor,
                accepted: visibleAccepted };
        }
        if (action === 'instagramLink') {
            if (!who.isAdmin) return fail(403, '관리자만 공유 링크를 등록할 수 있습니다.');
            let link = '';
            if (input.url !== '') {
                try {
                    const parsed = new URL(String(input.url));
                    if (parsed.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.port || !/^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(parsed.pathname)) throw new Error('invalid');
                    link = 'https://www.instagram.com' + parsed.pathname.replace(/\/?$/, '/');
                } catch { return fail(400, '인스타그램 게시물의 https 링크를 입력해주세요.'); }
            }
            await db.runTransaction(async tx => {
                const post = await tx.get(postRef); await ensurePost(post, who, tx);
                if (post.get('isPrivate') === true) fail(400, '비공개 글은 외부에 공유할 수 없습니다.');
                if (!post.get('sharing.instagram')) fail(400, '인스타그램 공유를 선택한 글만 등록할 수 있습니다.');
                tx.update(postRef, {sharedInstagramUrl: link});
            });
            const updated = await postRef.get();
            await loadAuthorAvatars([updated]);
            return {post: publicPost(updated)};
        }
        if (action === 'savePost') {
            let bodyDocument: ClubDocument | null | undefined;
            try { bodyDocument = input.bodyDocument === undefined ? undefined : input.bodyDocument === null ? null : normalizeDocument(input.bodyDocument); }
            catch (e) { return fail(400, (e as Error).message); }
            const documentFields = {bodyDocument: bodyDocument || null};
            let media: Awaited<ReturnType<typeof normalizeCommunityMedia>> | undefined;
            try { media = input.media === undefined ? undefined : await normalizeCommunityMedia(input.media); }
            catch (error) { return fail(400, (error as Error).message); }
            const target = room(input.roomId, who), title = text(input.title, 160, '제목'), body = text(bodyDocument ? documentText(bodyDocument) : input.body, 12000, '내용');
            if (input.kind !== 'feed' && input.kind !== 'question' && input.kind !== 'request') return fail(400, '글 형식을 선택해주세요.');
            if (input.kind === 'request' && !supportsCommunityRequests(target.id)) return fail(400, '요청하기는 라이프업, 비즈업, 만들기에서만 사용할 수 있습니다.');
            const kind = input.kind === 'request' || target.kind === 'both' ? input.kind : target.kind;
            const sharing = input.sharing as {newsletter?: unknown; kakao?: unknown; instagram?: unknown} | undefined;
            if (sharing !== undefined && (!sharing || typeof sharing !== 'object' || typeof sharing.newsletter !== 'boolean' || typeof sharing.kakao !== 'boolean' || (sharing.instagram !== undefined && typeof sharing.instagram !== 'boolean'))) fail(400, '공유 설정을 확인해주세요.');
            if (sharing && !who.isAdmin && (sharing.newsletter || sharing.kakao || sharing.instagram)) fail(403, '관리자만 외부 공유를 사용할 수 있습니다.');
            if (input.isPrivate !== undefined && typeof input.isPrivate !== 'boolean') fail(400, '공개 범위를 확인해주세요.');
            const isPrivate = input.isPrivate === true;
            if (isPrivate && (sharing?.newsletter || sharing?.kakao || sharing?.instagram)) fail(400, '비공개 글은 외부에 공유할 수 없습니다.');
            const channels = { instagram: sharing?.instagram === true, newsletter: sharing?.newsletter === true, kakao: sharing ? sharing.kakao === true : true };
            await db.runTransaction(async tx => {
                const member = await requireMember(who.uid, tx);
                const existing = await tx.get(postRef);
                const throttle = await tx.get(privateMembers.doc(who.uid));
                const draftRef = privateMembers.doc(who.uid).collection('drafts').doc(postRef.id);
                const sourceDraft = await tx.get(draftRef);
                if (existing.exists) {
                    await ensurePost(existing, who, tx); owner(existing.get('authorId'), who);
                    if (input.isPrivate !== undefined && isPrivate !== (existing.get('isPrivate') === true)) fail(400, '공개 범위는 게시 후 변경할 수 없습니다.');
                    // A lost create response can be retried with the same client-generated ID.
                    if (input.version === 0 && existing.get('authorId') === who.uid && existing.get('title') === title && existing.get('body') === body && existing.get('roomId') === target.id && existing.get('kind') === kind && JSON.stringify(existing.get('media') || []) === JSON.stringify(media || [])) return;
                    version(input.version, existing.get('version'));
                    if (existing.get('comments') > 0 && existing.get('kind') !== kind) fail(409, '답글이 있는 글의 형식은 변경할 수 없습니다.');
                    tx.update(postRef, { roomId: target.id, title, body, kind, ...documentFields, ...(media === undefined ? {} : {media}), updatedAt: now(), version: existing.get('version') + 1 });
                    if (who.uid !== existing.get('authorId')) notifications.record(tx, 'moderate-post:' + postRef.id + ':' + input.version, { type: 'moderated', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: title, recipientId: existing.get('authorId'), createdAt: now() });
                } else {
                    if (input.version !== 0) fail(404, '글이 삭제되었습니다.');
                    if (input.draftRevision !== undefined && (!sourceDraft.exists || sourceDraft.get('revision') !== input.draftRevision)) fail(409, '임시저장 내용이 변경되었거나 삭제되었습니다. 다시 열어주세요.');
                    if (sourceDraft.exists && input.draftRevision === undefined) fail(409, '임시저장 글에서 게시하기를 눌러주세요.');
                    if (now() - (throttle.get('lastPostAt') || 0) < 10000) fail(429, '잠시 후 새 글을 작성해주세요.');
                    tx.create(postRef, { isPrivate, roomId: target.id, kind, title, body, ...documentFields, media: media || [], authorId: who.uid, authorName: member.get('name'),
                        createdAt: now(), updatedAt: now(), version: 1, likes: 0, comments: 0, acceptedCommentId: null, visible: true, ...(who.isAdmin && !isPrivate ? {sharing: channels} : {}) });
                    tx.set(privateMembers.doc(who.uid), { lastPostAt: now() }, { merge: true });
                    if (sourceDraft.exists) tx.delete(draftRef);
                    if (isPrivate) {
                        for (const recipientId of adminIds) notifications.record(tx, 'private-post:' + postRef.id + ':' + recipientId, { type: 'private-post', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: title, recipientId, createdAt: now() });
                    }
                    if (who.isAdmin && !isPrivate) notifications.record(tx, 'admin-post:' + postRef.id, { type: 'admin-post', category: target.id === 'announcements' ? 'notices' : target.id === 'events' ? 'events' : 'adminPosts', actorId: who.uid, actorName: member.get('name'), postId: postRef.id, postTitle: title, createdAt: now(), kakao: channels.kakao, ...(channels.newsletter ? {newsletter: {title, body, ...(bodyDocument ? {bodyDocument} : {})}} : {}) });
                }
            });
            const updated = await postRef.get();
            await loadAuthorAvatars([updated]);
            return { post: publicPost(updated) };
        }
        if (action === 'deletePost') {
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const d = await tx.get(postRef); await ensurePost(d, who, tx); owner(d.get('authorId'), who); version(input.version, d.get('version'));
                if (who.uid !== d.get('authorId')) notifications.record(tx, 'moderate-delete:' + postRef.id, { type: 'moderated', actorId: who.uid, actorName: who.name, postId: postRef.id, postTitle: d.get('title'), recipientId: d.get('authorId'), createdAt: now() });
                tx.update(postRef, { visible: false, title: '', body: '', media: [], updatedAt: now(), version: d.get('version') + 1 });
            });
            return { ok: true };
        }
        if (action === 'like') {
            if (typeof input.liked !== 'boolean') return fail(400, '공감 상태를 확인해주세요.');
            await db.runTransaction(async tx => {
                await requireMember(who.uid, tx);
                const post = await tx.get(postRef); await ensurePost(post, who, tx);
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
                if (!member.exists || member.get('active') !== true) fail(403, '클럽에 먼저 가입해주세요.');
                await ensurePost(post, who, tx);
                if (comment.exists && (await withdrawnCommunityAuthors(db, [comment.get('authorId')], tx)).size) fail(404, '답글을 찾을 수 없습니다.');
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
