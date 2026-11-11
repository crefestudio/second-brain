import { communityEventWithdrawn } from './community-withdrawal';
import {createHash} from 'crypto';
import {COMMUNITY_ROOMS, isCommunityRoomVisible} from './community-model';
import type { firestore, auth as firebaseAuth } from 'firebase-admin';
type Firestore = firestore.Firestore;
type Auth = firebaseAuth.Auth;
import { renderCommunityNewsletter } from './community-newsletter';
import { NotificationCategory, NOTIFICATION_CATEGORIES } from './community-notification-settings';
import { CommunityEvent, notificationSettings, notificationCategory } from './community-notifications';

export interface KakaoEventConfig { enabled: boolean; botId: string; eventName: string; apiKey: string }
export function createKakaoEventClient(config: KakaoEventConfig, request: typeof fetch = fetch) {
    const ready = () => config.enabled && /^[a-zA-Z0-9_-]+!?$/.test(config.botId) && !!config.eventName && !!config.apiKey;
    return {
        ready,
        async send(user: { type: 'plusfriendUserKey' | 'botUserKey'; id: string }, data: Record<string, string>) {
            if (!ready()) throw new Error('KAKAO_EVENT_NOT_CONFIGURED');
            const r = await request('https://bot-api.kakao.com/v2/bots/' + encodeURIComponent(config.botId) + '/talk', {
                method: 'POST', headers: { Authorization: 'KakaoAK ' + config.apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: { name: config.eventName, data }, user: [user] }), signal: AbortSignal.timeout(15000)
            });
            const result = await r.json() as { status?: string; taskId?: string };
            if (result.status === 'FAIL') return { status: 'failed', taskId: '' };
            if (!r.ok || result.status !== 'SUCCESS' || !result.taskId) return { status: 'review', taskId: '' };
            return { status: 'submitted', taskId: result.taskId };
        },
        async status(taskId: string) {
            const r = await request('https://bot-api.kakao.com/v1/tasks/' + encodeURIComponent(taskId), {
                headers: { Authorization: 'KakaoAK ' + config.apiKey }, signal: AbortSignal.timeout(15000)
            });
            if (!r.ok) return 'submitted';
            const result = await r.json() as { status?: string; successCount?: number; allRequestCount?: number };
            return result.status === 'ALL SUCCESS' && result.successCount === 1 ? 'sent'
                : result.status?.includes('FAIL') ? 'failed' : 'submitted';
        }
    };
}
export async function canSendCommunityEmail(db: Firestore, auth: Auth, uid: string | undefined, email: string, category?: NotificationCategory, newsletterPostId?: string): Promise<boolean> {
    if (!uid) return false;
    const blockId = createHash('sha256').update('email:' + email.trim().toLowerCase()).digest('hex');
    if ((await db.collection('marketingBlocks').doc(blockId).get()).exists) return false;
    if (newsletterPostId) {
        const post = await db.collection('communityPosts').doc(newsletterPostId).get();
        if (!post.exists || !post.get('visible') || post.get('isPrivate') || !isCommunityRoomVisible(post.get('roomId')) || await communityEventWithdrawn(db, {postId:newsletterPostId})) return false;
    }
    const [member, state, account] = await Promise.all([
        db.collection('communityMembers').doc(uid).get(), db.collection('communityMemberPrivate').doc(uid).get(),
        db.collection('appAccounts').doc(uid).get()
    ]);
    const settings = notificationSettings(state.data());
    if (!member.get('active') || !settings.confirmed || !(category ? settings.categories[category]?.email === true : NOTIFICATION_CATEGORIES.every(c => settings.categories[c.id].email)) || account.get('deletionStatus') === 'pending') return false;
    try {
        const user = await auth.getUser(uid);
        return !user.disabled && user.emailVerified && user.email?.toLowerCase() === email.toLowerCase();
    } catch (error) {
        if ((error as {code?: string}).code === 'auth/user-not-found') return false;
        throw error;
    }
}
export async function communityKakaoRecipient(db: Firestore, uid: string) {
    const account = await db.collection('appAccounts').doc(uid).get();
    if (account.get('deletionStatus') === 'pending') return null;
    const owned = await db.collection('users').where('firebaseUid', '==', uid).limit(20).get();
    for (const workspace of owned.docs) {
        const key = workspace.get('kakaoUserId');
        if (!key || workspace.get('deletionStatus')) continue;
        const connection = await db.collection('kakaoConnections').doc(key).get();
        if (!connection.get('enabled') || (connection.get('userId') || connection.get('uid')) !== workspace.id) continue;
        // The existing capture queue stores Kakao's typed identity. Never guess a key type.
        const jobs = await workspace.ref.collection('integrations').doc('kakao-capture').collection('webhook_queue')
            .orderBy('sequence', 'desc').limit(20).get();
        for (const job of jobs.docs) {
            if (job.get('kakaoUserId') !== key || job.get('kakaoConnectionId') !== connection.get('connectionId')) continue;
            const user = job.get('user');
            if (user?.properties?.plusfriendUserKey === key) return { type: 'plusfriendUserKey' as const, id: key };
            if (user?.id === key && user?.type === 'botUserKey') return { type: 'botUserKey' as const, id: key };
        }
    }
    return null;
}
type QueueEmail = (uid: string, email: string, subject: string, text: string, key: string, html?: string, newsletterPostId?: string, category?: NotificationCategory) => Promise<void>;
export function createCommunityDelivery(db: Firestore, auth: Auth, queueEmail: QueueEmail,
    kakao: ReturnType<typeof createKakaoEventClient>, now = () => Date.now()) {
    const talks = db.collection('communityTalkDeliveries');
    async function deliver(uid: string, notificationId: string) {
        const ref = db.collection('communityMemberPrivate').doc(uid).collection('notifications').doc(notificationId);
        const [row, member, state, account] = await Promise.all([ref.get(), db.collection('communityMembers').doc(uid).get(),
            db.collection('communityMemberPrivate').doc(uid).get(), db.collection('appAccounts').doc(uid).get()]);
        if (!row.exists) return;
        const event = row.data() as CommunityEvent & {message: string};
        const settings = notificationSettings(state.data());
        if (!member.get('active') || !settings.confirmed || account.get('deletionStatus') === 'pending' || now() - event.createdAt > 86400000 || await communityEventWithdrawn(db, event)) {
            await ref.update({ 'delivery.email': 'skipped', 'delivery.talk': 'skipped' }); return;
        }
        let user;
        try { user = await auth.getUser(uid); } catch (error) {
            if ((error as {code?: string}).code !== 'auth/user-not-found') throw error;
            await ref.update({ 'delivery.email': 'skipped', 'delivery.talk': 'skipped' }); return;
        }
        if (!user.emailVerified || user.disabled) { await ref.update({ 'delivery.email': 'skipped', 'delivery.talk': 'skipped' }); return; }
        const important = event.type !== 'like';
        const roomId = !event.category && event.type === 'admin-post' ? (await db.collection('communityPosts').doc(event.postId).get()).get('roomId') : undefined;
        const category = notificationCategory(event, roomId);
        const channels = settings.categories[category];
        const url = 'https://club.notionable.net/?post=' + encodeURIComponent(event.postId);
        const newsletterPost = event.newsletter ? await db.collection('communityPosts').doc(event.postId).get() : null;
        if (event.newsletter && (!newsletterPost?.exists || !newsletterPost.get('visible') || newsletterPost.get('isPrivate') || !isCommunityRoomVisible(newsletterPost.get('roomId')))) {
            await ref.update({'delivery.email':'skipped','delivery.talk':'skipped'}); return;
        }
        if (important && channels.email && user.email) {
            const newsletter = event.type === 'admin-post' && event.newsletter ? renderCommunityNewsletter(event.newsletter.title, event.newsletter.body, url, {
                authorName:newsletterPost?.get('authorName') || event.actorName, roomName:COMMUNITY_ROOMS.find(r=>r.id===newsletterPost?.get('roomId'))?.name || '클럽', publishedAt:newsletterPost?.get('createdAt') || event.createdAt
            }, event.newsletter.bodyDocument) : null;
            // Generic message avoids distributing member-authored content outside the gated community.
            await queueEmail(uid, user.email, newsletter ? '[노셔너블 클럽 뉴스레터] ' + event.newsletter?.title : '[노셔너블 클럽] 새로운 알림이 있습니다',
                newsletter ? newsletter.text : '노셔너블 클럽에 새로운 알림이 도착했습니다.\n\n로그인 후 확인하기: ' + url +
                '\n\n알림 설정 변경: https://club.notionable.net/?settings=notifications', 'community:' + uid + ':' + notificationId, newsletter?.html, newsletter ? event.postId : undefined, category);
            await ref.update({ 'delivery.email': 'queued' });
        } else await ref.update({ 'delivery.email': 'disabled' });
        if (!important || !channels.talk || (event.type === 'admin-post' && event.kakao === false)) { await ref.update({ 'delivery.talk': 'disabled' }); return; }
        if (!kakao.ready()) { await ref.update({ 'delivery.talk': 'not-configured' }); return; }
        const recipient = await communityKakaoRecipient(db, uid);
        if (!recipient) { await ref.update({ 'delivery.talk': 'not-connected' }); return; }
        const job = talks.doc(uid + '_' + notificationId);
        const claim = await db.runTransaction(async tx => {
            const previous = await tx.get(job);
            if (previous.exists) return false;
            tx.create(job, { uid, notificationId, status: 'sending', createdAt: now(), notificationPath: ref.path });
            return true;
        });
        if (!claim) return;
        // Recheck consent immediately before the external side effect.
        const latest = notificationSettings((await state.ref.get()).data());
        if (!latest.confirmed || !latest.talk || !(await member.ref.get()).get('active') || await communityEventWithdrawn(db, event)) { await job.update({ status: 'cancelled' }); await ref.update({ 'delivery.talk': 'disabled' }); return; }
        let result: {status: string; taskId: string};
        try { result = await kakao.send(recipient, { text: event.type === 'admin-post' && event.kakao === true ? '[노셔너블 클럽] ' + event.postTitle : '노셔너블 클럽에 새로운 알림이 도착했습니다.', url }); }
        catch { result = { status: 'review', taskId: '' }; }
        await job.update({ ...result, updatedAt: now() });
        await ref.update({ 'delivery.talk': result.status });
    }
    async function reconcile() {
        const stale = await talks.where('status', '==', 'sending').limit(50).get();
        for (const job of stale.docs) if (now() - job.get('createdAt') > 600000) {
            await job.ref.update({status:'review'});
            await db.doc(job.get('notificationPath')).update({'delivery.talk':'review'});
        }
        if (!kakao.ready()) return;
        const rows = await talks.where('status', '==', 'submitted').limit(30).get();
        for (const row of rows.docs) {
            const status = now() - row.get('createdAt') > 86400000 ? 'review' : await kakao.status(row.get('taskId'));
            if (status !== 'submitted') { await row.ref.update({status,updatedAt:now()}); await db.doc(row.get('notificationPath')).update({'delivery.talk':status}); }
        }
    }
    return { deliver, reconcile };
}
