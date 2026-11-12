import { firestore } from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';

export function createNotionPageWork(db: firestore.Firestore) {
    const queue = db.collection('notionPageWork');
    const locks = db.collection('notionWorkLocks');
    const stamp = firestore.FieldValue.serverTimestamp;
    async function acquire(userId: string): Promise<string | null> {
        const claim = randomUUID();
        return db.runTransaction(async tx => {
            const ref = locks.doc(userId);
            if (((await tx.get(ref)).data()?.until || 0) > Date.now()) return null;
            tx.set(ref, { claim, until: Date.now() + 600000 });
            return claim;
        });
    }
    async function release(userId: string, claim: string) {
        await db.runTransaction(async tx => {
            const ref = locks.doc(userId);
            if ((await tx.get(ref)).data()?.claim === claim) tx.delete(ref);
        });
    }
    async function enqueue(userId: string, connectionId: string | null, event: any, onlyMissing = false) {
        const id = createHash('sha256').update(`${userId}:${connectionId}:${event.entity.id.replace(/-/g, '')}`).digest('hex');
        const ref = queue.doc(id);
        await db.runTransaction(async tx => {
            const previous = (await tx.get(ref)).data();
            const time = Date.parse(event.timestamp) || Date.now();
            if (previous && previous.eventTime >= time && !onlyMissing) return;
            tx.set(ref, { userId, connectionId, event, eventTime: time, onlyMissing,
                version: (previous?.version || 0) + 1, attempts: 0, status: 'pending',
                nextAt: Date.now() + 5000, queuedAt: stamp() });
        });
        return id;
    }
    async function drain(process: (item: any) => Promise<void>) {
        const start = Date.now();
        const items = await queue.where('nextAt', '<=', start).orderBy('nextAt').limit(10).get();
        for (const doc of items.docs) {
            if (Date.now() - start > 400000) break;
            const item = doc.data();
            const claim = await acquire(item.userId);
            if (!claim) {
                await db.runTransaction(async tx => {
                    if ((await tx.get(doc.ref)).data()?.version === item.version) tx.update(doc.ref, { nextAt: Date.now() + 60000 });
                });
                continue;
            }
            let status = 'completed', errorCode = '';
            let applicable = false;
            try {
                const current = (await doc.ref.get()).data();
                if (!current || current.version !== item.version || !['pending', 'retry'].includes(current.status)) continue;
                applicable = true;
                await process(item);
            } catch (error: any) {
                errorCode = String(error?.code || error?.message || 'PROCESSING_FAILED');
                if (!/^[A-Z0-9_]{1,80}$/i.test(errorCode)) errorCode = 'PROCESSING_FAILED';
                status = ['NOTION_CONNECTION_CHANGED', 'SECOND_BRAIN_AUTOMATION_DISABLED', 'STALE_WEBHOOK', 'NO_MATCHING_WORKSPACE'].includes(errorCode)
                    ? 'discarded' : [401, 403, 404].includes(Number(error?.status)) || (item.attempts || 0) >= 4 ? 'needs_attention' : 'retry';
                if (status === 'needs_attention') console.error('[Notion page work] review required', { workId: doc.ref.id, code: errorCode });
            } finally {
                try {
                    if (applicable) await db.runTransaction(async tx => {
                        if ((await tx.get(doc.ref)).data()?.version !== item.version) return;
                        tx.update(doc.ref, { status, lastErrorCode: errorCode, attempts: (item.attempts || 0) + 1,
                            nextAt: status === 'retry' ? Date.now() + Math.min(900000, 60000 * 2 ** (item.attempts || 0)) : firestore.FieldValue.delete(),
                            finishedAt: stamp() });
                    });
                } finally { await release(item.userId, claim); }
            }
        }
    }
    return { enqueue, drain, acquire, release };
}
