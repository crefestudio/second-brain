import {notificationPreferences} from './community-notification-settings';
import type { firestore } from 'firebase-admin';

/** A durable visibility barrier; it must remain until reviewed cleanup is complete. */
export const isCommunityWithdrawn = (data: firestore.DocumentData | undefined) =>
    data?.withdrawalStatus === 'pending' || data?.withdrawalStatus === 'completed';

export async function withdrawnCommunityAuthors(db: firestore.Firestore, ids: string[], tx?: firestore.Transaction) {
    const unique = [...new Set(ids.filter(Boolean))];
    const hidden = new Set<string>();
    for (let i = 0; i < unique.length; i += 100) {
        const refs = unique.slice(i, i + 100).map(uid => db.collection('communityMembers').doc(uid));
        const rows = tx ? await tx.getAll(...refs) : await db.getAll(...refs, {fieldMask: ['withdrawalStatus']});
        rows.forEach(row => { if (isCommunityWithdrawn(row.data())) hidden.add(row.id); });
    }
    return hidden;
}

/** Read-only gate shared by inboxes and delivery workers, including old queued events. */
export async function communityEventWithdrawn(db: firestore.Firestore, event: {actorId?: string; postId?: string}, tx?: firestore.Transaction) {
    const ref = event.postId ? db.collection('communityPosts').doc(event.postId) : null;
    const post = ref ? (tx ? await tx.get(ref) : await ref.get()) : null;
    const ids = [event.actorId || '', post?.get('authorId') || ''];
    return (await withdrawnCommunityAuthors(db, ids, tx)).size > 0;
}

/** Only records an authenticated request. No deletion, sweeper, TTL or external calls. */
export async function requestCommunityWithdrawal(db: firestore.Firestore, uid: string, now: () => number) {
    return db.runTransaction(async tx => {
        const memberRef = db.collection('communityMembers').doc(uid);
        const queueRef = db.collection('communityWithdrawalRequests').doc(uid);
        const [member, queued] = await tx.getAll(memberRef, queueRef);
        if (isCommunityWithdrawn(member.data())) return {ok: true, withdrawalStatus: member.get('withdrawalStatus')};
        if (member.get('active') !== true) return {ok: false};
        const requestedAt = now();
        tx.update(memberRef, {active: false, withdrawalStatus: 'pending', withdrawnAt: requestedAt});
        tx.set(db.collection('communityMemberPrivate').doc(uid), {
            notificationSettings: {email: false, talk: false, categories: notificationPreferences({email:false,talk:false}), confirmedAt: requestedAt}, unreadCount: 0
        }, {merge: true});
        if (!queued.exists) tx.create(queueRef, {
            uid, scope: 'community-only', status: 'pending_manual_review', requestedAt, schemaVersion: 1
        });
        return {ok: true, withdrawalStatus: 'pending'};
    });
}
