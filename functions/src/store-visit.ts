import { createHash } from 'crypto';
import { firestore } from 'firebase-admin';
const Timestamp = firestore.Timestamp;

export const VISIT_WINDOW_MS = 30 * 60 * 1000;
export async function saveTrackingVisit(db: firestore.Firestore, collection: 'storeVisits' | 'siteVisits', visit: { productPath?: string; location: string; referrer: string; sessionId: string; occurredAt: firestore.Timestamp; path?: string; targetName?: string }) {
    const key = createHash('sha256').update(JSON.stringify([collection, visit.sessionId, visit.productPath || '', visit.location])).digest('hex');
    const guard = db.collection(collection === 'storeVisits' ? 'storeVisitDedup' : 'siteVisitDedup').doc(key);
    const event = db.collection(collection).doc();
    return db.runTransaction(async tx => {
        const reset = await tx.get(db.collection('storeVisitSettings').doc('reset'));
        const previous = await tx.get(guard);
        const now = Timestamp.now();
        const resetAt = reset.data()?.resetAt;
        if (resetAt instanceof Timestamp && visit.occurredAt.toMillis() <= resetAt.toMillis()) return { recorded: false, ignored: 'RESET' };
        const last = previous.data()?.createdAt;
        if (last instanceof Timestamp && now.toMillis() - last.toMillis() < VISIT_WINDOW_MS &&
            (!(resetAt instanceof Timestamp) || last.toMillis() > resetAt.toMillis())) return { recorded: false, ignored: 'DUPLICATE' };
        tx.set(event, { ...visit, createdAt: now });
        tx.set(guard, { createdAt: now });
        return { recorded: true };
    });
}

export const saveStoreVisit = (db: firestore.Firestore, visit: { productPath: string; location: string; referrer: string; sessionId: string; occurredAt: firestore.Timestamp }) => saveTrackingVisit(db, 'storeVisits', visit);
