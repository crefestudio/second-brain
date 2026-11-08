import { createHash } from 'crypto';
import { firestore } from 'firebase-admin';
type Firestore = firestore.Firestore;
type Transaction = firestore.Transaction;
const FieldPath = firestore.FieldPath;

export type CommunityNotificationType = 'admin-post' | 'comment' | 'like' | 'accepted' | 'moderated';
export interface CommunityEvent {
    type: CommunityNotificationType; actorId: string; actorName: string;
    newsletter?: { title: string; body: string }; kakao?: boolean;
    postId: string; postTitle: string; recipientId?: string; createdAt: number;
}
export const notificationSettings = (data: FirebaseFirestore.DocumentData | undefined) => ({
    email: data?.notificationSettings?.email !== false,
    talk: data?.notificationSettings?.talk !== false,
    confirmed: typeof data?.notificationSettings?.confirmedAt === 'number'
});
export const notificationText = (event: CommunityEvent): string => {
    const name = event.actorName;
    return event.type === 'admin-post' ? name + ' 관리자가 새 글을 올렸습니다.'
        : event.type === 'comment' ? name + '님이 내 글에 댓글·답변을 남겼습니다.'
        : event.type === 'like' ? name + '님이 내 글에 공감했습니다.'
        : event.type === 'accepted' ? name + '님이 내 답변을 채택했습니다.'
        : '관리자가 내 글 또는 댓글을 수정·삭제했습니다.';
};
export function createCommunityNotifications(db: Firestore, now = () => Date.now()) {
    const events = db.collection('communityNotificationEvents');
    const privateMembers = db.collection('communityMemberPrivate');
    const inbox = (uid: string) => privateMembers.doc(uid).collection('notifications');
    function record(tx: Transaction, key: string, event: CommunityEvent) {
        if (event.recipientId === event.actorId) return;
        // Stable event keys plus create-only triggers suppress retries and repeated likes.
        const eventId = createHash('sha256').update(key).digest('hex');
        tx.set(events.doc(eventId), event, { merge: true });
    }
    async function fanout(eventId: string) {
        const ref = events.doc(eventId), snapshot = await ref.get();
        if (!snapshot.exists || snapshot.get('completedAt')) return;
        const event = snapshot.data() as CommunityEvent;
        async function deliver(uid: string) {
            if (uid === event.actorId) return;
            await db.runTransaction(async tx => {
                const memberRef = db.collection('communityMembers').doc(uid), target = inbox(uid).doc(eventId);
                const [member, existing, state] = await Promise.all([tx.get(memberRef), tx.get(target), tx.get(privateMembers.doc(uid))]);
                if (existing.exists || !member.get('active') || member.get('joinedAt') > event.createdAt) return;
                const read = event.createdAt <= (state.get('readThrough') || 0);
                tx.create(target, { ...event, message: notificationText(event), readAt: read ? now() : null, delivery: { email: 'pending', talk: 'pending' } });
                if (!read) tx.set(state.ref, { unreadCount: (state.get('unreadCount') || 0) + 1 }, { merge: true });
            });
        }
        if (event.recipientId) await deliver(event.recipientId);
        else if (event.type === 'admin-post') {
            let after: string = snapshot.get('cursor') || '';
            let hasMore = true;
            while (hasMore) {
                let q = db.collection('communityMembers').orderBy(FieldPath.documentId()).limit(100);
                if (after) q = q.startAfter(after);
                const members = await q.get();
                for (let i = 0; i < members.docs.length; i += 10) {
                    await Promise.all(members.docs.slice(i, i + 10).map(member => deliver(member.id)));
                }
                hasMore = members.size === 100;
                if (hasMore) {
                    after = members.docs[members.size - 1].id;
                    await ref.set({ cursor: after }, { merge: true });
                }
            }
        }
        await ref.set({ completedAt: now() }, { merge: true });
    }
    async function list(uid: string, point?: [number, string] | null) {
        const state = await privateMembers.doc(uid).get();
        let query = inbox(uid).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
        if (point) query = query.startAfter(...point);
        const result = await query.limit(31).get(), docs = result.docs.slice(0, 30), last = docs[docs.length - 1];
        return { items: docs.map(d => ({ id: d.id, type: d.get('type'), message: d.get('message'), postId: d.get('postId'),
            postTitle: d.get('postTitle'), createdAt: d.get('createdAt'),
            read: !!d.get('readAt') || d.get('createdAt') <= (state.get('readThrough') || 0) })),
            unreadCount: state.get('unreadCount') || 0,
            nextCursor: result.size > 30 && last ? [last.get('createdAt'), last.id] : null };
    }
    async function read(uid: string, notificationId?: string) {
        const ref = privateMembers.doc(uid);
        await db.runTransaction(async tx => {
            const state = await tx.get(ref);
            if (!notificationId) { tx.set(ref, { readThrough: now(), unreadCount: 0 }, { merge: true }); return; }
            const row = await tx.get(inbox(uid).doc(notificationId));
            if (!row.exists || row.get('readAt') || row.get('createdAt') <= (state.get('readThrough') || 0)) return;
            tx.update(row.ref, { readAt: now() });
            tx.set(ref, { unreadCount: Math.max(0, (state.get('unreadCount') || 0) - 1) }, { merge: true });
        });
    }
    return { record, fanout, list, read };
}
