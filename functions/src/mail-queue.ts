/* eslint-disable */
import { createHash, randomUUID } from 'crypto';
import { FieldValue, Firestore, DocumentData } from 'firebase-admin/firestore';

// `critical` remains readable only for messages that were queued before the
// two-pool policy. New messages are high or normal.
export type MailPriority = 'critical' | 'high' | 'normal';
export interface QueueMail { from: string; to: string | string[]; subject: string; text?: string; html?: string }
export const MAIL_LIMITS = { total: 100, normal: 70 };
export const mailDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export function nextMailMorning(now: number): number {
    // Next Korean 10:00 after the current provider accounting day (UTC).
    return Date.parse(mailDay(now) + 'T01:00:00Z') + 86400000;
}
export function hasMailCapacity(used: Record<string, number>, priority: MailPriority): boolean {
    const total = (used.critical || 0) + (used.high || 0) + (used.normal || 0);
    return total < MAIL_LIMITS.total && (priority !== 'normal' || (used.normal || 0) < MAIL_LIMITS.normal);
}
type Provider = (mail: QueueMail, key: string) => Promise<{ data: { id: string } | null; error: { message: string; name?: string; statusCode?: number | null } | null }>;
const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function createMailQueue(db: Firestore, provider: Provider, canSend: (email: string) => Promise<boolean>) {
    const queue = db.collection('mailQueue');
    const control = db.collection('mailQueueControl').doc('sender');
    const quotas = db.collection('mailDailyUsage');
    async function enqueue(mail: QueueMail, priority: MailPriority, key: string = randomUUID(), immediate = false, notBeforeAt?: number, queueOrder?: number) {
        const addresses = [...new Set((Array.isArray(mail.to) ? mail.to : [mail.to]).map(email => email.trim().toLowerCase()))];
        const ids: string[] = [];
        for (const email of addresses) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
            const ref = queue.doc(hash(key + ':' + email));
            const excluded = !await canSend(email);
            await db.runTransaction(async tx => {
                if ((await tx.get(ref)).exists) return;
                const now = Date.now();
                const nextAttemptAt = immediate ? now : Math.max(now, Number(notBeforeAt) || now);
                tx.create(ref, { mail: { ...mail, to: email }, subject: mail.subject, recipient: email,
                    priority, status: excluded ? 'cancelled' : 'pending', createdAt: now,
                    ...(queueOrder === undefined ? {} : { queueOrder }),
                    ...(excluded ? { lastError: '수신 차단으로 미발송', excludedAt: now } : { nextAttemptAt: now, attempts: 0 }),
                    ...(!excluded ? { nextAttemptAt } : {}),
                    ...(immediate ? { immediate: true, expiresAt: now + 9 * 60000 } : {}) });
            });
            ids.push(ref.id);
        }
        return ids;
    }

    async function attempt(id: string, immediate = false): Promise<string> {
        const ref = queue.doc(id);
        const token = randomUUID();
        const claim = await db.runTransaction(async tx => {
            const now = Date.now();
            const quotaRef = quotas.doc(mailDay(now));
            const [snapshot, lock, quota] = await Promise.all([tx.get(ref), tx.get(control), tx.get(quotaRef)]);
            const data = snapshot.data();
            if (!data || !['pending', 'sending'].includes(data.status)) return { status: data?.status || 'missing' };
            if (data.nextAttemptAt > now && !(immediate && data.immediate && data.status === 'pending')) return { status: data.status === 'sending' ? 'busy' : 'pending' };
            if (data.expiresAt && data.expiresAt <= now) {
                tx.update(ref, { status: 'expired', mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() });
                return { status: 'expired' };
            }
            // Resend only retains idempotency keys for 24h. Never blindly replay
            // an ambiguous request outside that window.
            if (data.firstAttemptAt && now - data.firstAttemptAt >= 23 * 3600000) {
                tx.update(ref, { status: 'review', lastError: '발송 결과 확인 필요', nextAttemptAt: FieldValue.delete(), mail: FieldValue.delete() });
                return { status: 'review' };
            }
            const lockData = lock.data() || {};
            if (lockData.leaseUntil > now || lockData.nextSendAt > now) return { status: 'busy' };
            if (lockData.pausedUntil > now) {
                tx.update(ref, { nextAttemptAt: lockData.pausedUntil, lastError: '메일 서비스 한도 대기' });
                return { status: 'pending' };
            }
            const used = quota.data() || {};
            const priority = data.priority as MailPriority;
            // Replaying a reserved attempt does not consume another slot.
            if (data.reservedDay !== mailDay(now)) {
                if (!hasMailCapacity(used, priority)) {
                    tx.update(ref, { status: 'pending', nextAttemptAt: nextMailMorning(now), lastError: '일일 발송 한도 대기' });
                    return { status: 'pending' };
                }
                tx.set(quotaRef, { [priority]: (used[priority] || 0) + 1 }, { merge: true });
            }
            tx.set(control, { leaseUntil: now + 120000, token }, { merge: true });
            tx.update(ref, { status: 'sending', token, reservedDay: mailDay(now),
                firstAttemptAt: data.firstAttemptAt || now, nextAttemptAt: now + 120000, attempts: data.attempts + 1 });
            return { status: 'claimed', data };
        });
        if (claim.status !== 'claimed' || !claim.data) return claim.status;
        const data = claim.data;
        let status = 'pending';
        let pauseUntil = 0;
        let update: DocumentData;
        try {
            const excluded = !await canSend(data.recipient);
            if (excluded) {
                status = 'cancelled';
                update = { status, lastError: '수신 차단으로 미발송', excludedAt: Date.now(), mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() };
                update = { status, lastError: '수신 차단', mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() };
                update = { status, lastError: '수신 차단으로 미발송', excludedAt: Date.now(), mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() };
            } else {
                const result = await provider(data.mail, 'mail-queue/' + id);
                if (result.error) {
                    const error = result.error;
                    const quotaError = /daily|monthly|quota|sending limit/i.test(error.message + ' ' + error.name);
                    const retryable = quotaError || error.statusCode === 429 || (error.statusCode || 0) >= 500 || error.name === 'application_error' || error.name === 'concurrent_idempotent_requests';
                    status = retryable ? 'pending' : 'failed';
                    if (quotaError) pauseUntil = nextMailMorning(Date.now());
                    // An explicit rejection was not accepted: a later attempt may use
                    // a fresh idempotency window. Ambiguous network errors never do.
                    update = { status, lastError: error.message, nextAttemptAt: retryable ? (pauseUntil || Date.now() + 60000) : FieldValue.delete(),
                        ...(quotaError ? { firstAttemptAt: FieldValue.delete() } : {}),
                        ...(!retryable ? { mail: FieldValue.delete() } : {}) };
                } else if (result.data?.id) {
                    status = 'sent';
                    update = { status, resendId: result.data.id, sentAt: Date.now(), lastError: '', mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() };
                } else throw new Error('메일 서비스 응답 확인 필요');
            }
        } catch {
            update = { status: 'pending', lastError: '응답 미확인 · 중복 방지 키로 재시도', nextAttemptAt: Date.now() + 60000 };
        }
        await db.runTransaction(async tx => {
            const [current, lock] = await Promise.all([tx.get(ref), tx.get(control)]);
            if (current.data()?.token === token) tx.update(ref, update);
            if (lock.data()?.token === token) tx.set(control, { leaseUntil: 0, nextSendAt: Date.now() + 1000,
                ...(pauseUntil ? { pausedUntil: pauseUntil } : {}) }, { merge: true });
        });
        return status;
    }

    async function send(mail: QueueMail, priority: MailPriority, key?: string, immediate = false, notBeforeAt?: number, queueOrder?: number) {
        const ids = await enqueue(mail, priority, key, immediate, notBeforeAt, queueOrder);
        if (immediate) {
            for (const id of ids) {
                let state = 'busy';
                for (let retry = 0; retry < 12 && state === 'busy'; retry++) {
                    state = await attempt(id, true);
                    if (state === 'busy') await sleep(1000);
                }
                if (state !== 'sent') {
                    // A failed login request must not send a stale code later.
                    await db.runTransaction(async tx => {
                        const row = (await tx.get(queue.doc(id))).data();
                        if (row?.status === 'pending') tx.update(queue.doc(id), { status: 'failed', lastError: '인증 메일 즉시 발송 실패 · 다시 요청해주세요', mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() });
                    });
                    return { data: null, error: { message: '인증 메일을 발송하지 못했습니다. 잠시 후 다시 요청해주세요.' } };
                }
            }
        }
        return { data: { id: ids[0] }, error: null };
    }

    async function drain() {
        const deadline = Date.now() + 45000;
        // Separate queries prevent a large normal backlog from hiding a newly
        // arrived authentication or purchase message.
        while (Date.now() < deadline) {
            const ready = await Promise.all(['high', 'normal', 'critical'].map(priority =>
                queue.where('priority', '==', priority).where('nextAttemptAt', '<=', Date.now()).orderBy('nextAttemptAt').limit(1).get()));
            const row = ready.find(result => !result.empty)?.docs[0];
            if (!row) break;
            await attempt(row.id);
            await sleep(1100);
        }
    }
    async function list(before?: number, beforeId?: string) {
        let query = queue.orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(100);
        if (before && beforeId) query = query.startAfter(before, beforeId);
        const [rows, usage] = await Promise.all([query.get(), quotas.doc(mailDay(Date.now())).get()]);
        return { items: rows.docs.map(doc => {
            const { mail, token, ...data } = doc.data();
            return { id: doc.id, ...data };
        }), usage: usage.data() || {}, limits: MAIL_LIMITS, nextMorning: nextMailMorning(Date.now()) };
    }
    async function cancel(id: string) {
        const ref = queue.doc(id);
        return db.runTransaction(async tx => {
            const row = (await tx.get(ref)).data();
            if (!row) return 'missing';
            if (row.status !== 'pending') return row.status;
            tx.update(ref, { status: 'cancelled', cancelledAt: Date.now(), lastError: '관리자가 발송 대기를 취소했습니다.',
                mail: FieldValue.delete(), nextAttemptAt: FieldValue.delete() });
            return 'cancelled';
        });
    }
    return { enqueue, send, drain, list, cancel, attempt };
}
