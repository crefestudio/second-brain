import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
const FieldValue = admin.firestore.FieldValue;

// Longer than either worker's 540 second hard timeout. Never steal a live worker.
const LEASE_MS = 11 * 60 * 1000;
export function createKakaoQueue(db: admin.firestore.Firestore, process: (uid: string, job: any, id: string) => Promise<void>, now = Date.now) {
    const controls = db.collection('kakaoQueueWorkers');
    const jobs = (uid: string) => db.collection(`users/${uid}/integrations/kakao-capture/webhook_queue`);
    async function enqueue(uid: string, data: any) {
        const ref = jobs(uid).doc();
        const control = controls.doc(uid);
        return db.runTransaction(async tx => {
            const state = (await tx.get(control)).data() || {};
            const sequence = (state.sequence || 0) + 1;
            const waiting = (state.outstanding || 0) > 0;
            tx.create(ref, { ...data, queueVersion: 2, sequence, status: 'pending', createdAt: FieldValue.serverTimestamp() });
            tx.set(control, { sequence, outstanding: (state.outstanding || 0) + 1, active: true }, { merge: true });
            return { id: ref.id, waiting };
        });
    }
    async function drain(uid: string) {
        const control = controls.doc(uid);
        const owner = randomUUID();
        const acquired = await db.runTransaction(async tx => {
            const state = (await tx.get(control)).data();
            if (!state?.active || state.leaseUntil > now()) return false;
            tx.update(control, { owner, leaseUntil: now() + LEASE_MS });
            return true;
        });
        if (!acquired) return;
        const started = now();
        try {
            // A previous invocation may have died after Notion accepted its write.
            // Preserve such jobs for review rather than blindly duplicating them.
            const interrupted = await jobs(uid).where('status', '==', 'processing').get();
            for (const row of interrupted.docs) {
                if (row.data().queueVersion === 2) await finish(row.id, 'error', 'INTERRUPTED_REQUIRES_REVIEW');
            }
            while (now() - started < 4 * 60 * 1000) {
                const pending = await jobs(uid).where('status', '==', 'pending').get();
                const row = pending.docs.filter(d => d.data().queueVersion === 2)
                    .sort((a, b) => a.data().sequence - b.data().sequence)[0];
                if (!row) break;
                await row.ref.update({ status: 'processing', startedAt: FieldValue.serverTimestamp() });
                try {
                    console.log('[KAKAO FIFO] start', { userId: uid, jobId: row.id });
                    await process(uid, row.data(), row.id);
                    await finish(row.id, 'done');
                    console.log('[KAKAO FIFO] done', { userId: uid, jobId: row.id });
                } catch (error) {
                    await finish(row.id, 'error', String(error));
                    console.error('[KAKAO FIFO] error', { userId: uid, jobId: row.id, error: String(error) });
                }
            }
        } finally {
            await db.runTransaction(async tx => {
                const state = (await tx.get(control)).data();
                if (state?.owner !== owner) return;
                tx.update(control, { owner: null, leaseUntil: 0, active: state.outstanding > 0 });
            });
        }
        async function finish(id: string, status: string, error?: string) {
            await db.runTransaction(async tx => {
                const state = (await tx.get(control)).data();
                const ref = jobs(uid).doc(id);
                const job = (await tx.get(ref)).data();
                if (state?.owner !== owner) throw new Error('KAKAO_QUEUE_LEASE_LOST');
                if (!job || job.status === 'done' || job.status === 'error') return;
                tx.update(ref, { status, ...(error ? { error } : {}), finishedAt: FieldValue.serverTimestamp() });
                tx.update(control, { outstanding: Math.max(0, state.outstanding - 1) });
            });
        }
    }
    async function recover() {
        const active = await controls.where('active', '==', true).get();
        await Promise.all(active.docs.map(row => drain(row.id)));
    }
    return { enqueue, drain, recover };
}
