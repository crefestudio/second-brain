import { firestore } from 'firebase-admin';
import { normalizeGiftEmail, normalizeYoutubeHandle } from './lifeup-gift';

export class GiftRegistrationConflict extends Error {
    constructor() { super('이미 등록된 아이디 입니다.'); }
}

// The transaction keeps the first email binding even for simultaneous claims.
// Email is registered for the giveaway; the optional check box only controls SMS.
export async function registerGiftApplication(db: firestore.Firestore, input: {
    youtubeHandle: string; email: string; marketingConsent?: boolean;
    comment: { videoId: string; channelId: string; commentId: string };
}): Promise<boolean | undefined> {
    const { comment } = input;
    const email = normalizeGiftEmail(input.email);
    const ref = db.collection('lifeupFreeApplications').doc(`${comment.videoId}_${comment.channelId}`);
    return db.runTransaction(async transaction => {
        const existing = await transaction.get(ref);
        const previous = existing.data();
        if (previous?.email) {
            if (normalizeGiftEmail(previous.email) !== email) throw new GiftRegistrationConflict();
            if (typeof previous.marketingSmsConsent === 'boolean') return previous.marketingSmsConsent;
            if (typeof previous.marketingConsent === 'boolean') return previous.marketingConsent;
            // A record made before the choice was added can acquire the first
            // explicit SMS choice on a later application.
            if (typeof input.marketingConsent === 'boolean') {
                transaction.set(ref, {
                    marketingEmailConsent: true,
                    marketingSmsConsent: input.marketingConsent,
                    marketingConsent: input.marketingConsent,
                    marketingConsentVersion: 2,
                    marketingConsentAt: firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return input.marketingConsent;
            }
            return undefined;
        }
        // Older comment-only records acquire their first email on the next claim.
        transaction.set(ref, {
            email, youtubeHandle: normalizeYoutubeHandle(input.youtubeHandle),
            eventName: '무료6종 댓글 이벤트',
            subscribedAndLiked: true, commented: true,
            commentVerificationStatus: 'verified',
            youtubeVideoId: comment.videoId, youtubeChannelId: comment.channelId, youtubeCommentId: comment.commentId,
            commentVerifiedAt: firestore.FieldValue.serverTimestamp(),
            source: 'lifeup-free',
            marketingEmailConsent: true,
            ...(typeof input.marketingConsent === 'boolean' ? {
                marketingSmsConsent: input.marketingConsent,
                // Retain the legacy field while existing reporting still reads it.
                marketingConsent: input.marketingConsent,
                marketingConsentVersion: 2,
                marketingConsentAt: firestore.FieldValue.serverTimestamp()
            } : {}),
            submittedAt: previous?.submittedAt || firestore.FieldValue.serverTimestamp(),
            emailRegisteredAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return input.marketingConsent;
    });
}
