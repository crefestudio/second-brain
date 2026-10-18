import type * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { legacyConsentPatch, parseConsent } from './marketing-consent';

export const consentEmailId = (email: string): string => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export async function migrateMarketingConsents(db: admin.firestore.Firestore): Promise<number> {
    let count = 0;
    for (const collection of ['appAccounts', 'customers']) {
        let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let query = db.collection(collection).orderBy('__name__').limit(200);
            if (cursor) query = query.startAfter(cursor);
            const page = await query.get();
            if (page.empty) break;
            await Promise.all(page.docs.filter(doc => Object.keys(legacyConsentPatch(doc.data())).length).map(async doc => {
                await db.runTransaction(async tx => {
                    const current = (await tx.get(doc.ref)).data() || {};
                    const patch = legacyConsentPatch(current);
                    if (!Object.keys(patch).length) return;
                    tx.set(doc.ref, { ...patch, consentMigratedAt: new Date() }, { merge: true });
                });
                if (Object.keys(legacyConsentPatch(doc.data())).length) count++;
            }));
            cursor = page.docs[page.docs.length - 1];
        }
    }
    return count;
}

// Retrieve all existing members, not only new signups: consent can change later.
export async function syncImwebMarketingConsents(db: admin.firestore.Firestore, token: string): Promise<{ members: number; emails: number }> {
    const grouped = new Map<string, { codes: string[]; email: boolean[]; sms: boolean[] }>();
    const seen = new Set<string>();
    let finished = false;
    for (let page = 1; page <= 500; page++) {
        if (page > 1) await new Promise(resolve => setTimeout(resolve, 1100));
        const response = await fetch(`https://api.imweb.me/v2/member/members?limit=100&page=${page}`, {
            headers: { 'access-token': token }, signal: AbortSignal.timeout(30000)
        });
        const payload = await response.json();
        if (!response.ok || Number(payload.code) !== 200 || !Array.isArray(payload.data?.list)) throw new Error('IMWEB_MEMBERS_RESPONSE_INVALID');
        const rows = payload.data.list;
        if (!rows.length) { finished = true; break; }
        for (const row of rows) {
            const code = String(row.member_code || '');
            if (!code || seen.has(code)) throw new Error('IMWEB_MEMBERS_PAGINATION_INVALID');
            seen.add(code);
            const email = String(row.email || '').trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
            const item = grouped.get(email) || { codes: [], email: [], sms: [] };
            item.codes.push(code);
            const emailConsent = parseConsent(row.marketing_agree_email);
            const smsConsent = parseConsent(row.marketing_agree_sms);
            if (emailConsent !== undefined) item.email.push(emailConsent);
            if (smsConsent !== undefined) item.sms.push(smsConsent);
            grouped.set(email, item);
        }
        if (rows.length < 100) { finished = true; break; }
    }
    if (!finished) throw new Error('IMWEB_MEMBERS_PAGE_LIMIT');
    const now = new Date();
    // Store a separate email-level source; grouped customer rows never merge permissions.
    const entries = [...grouped.entries()];
    for (let offset = 0; offset < entries.length; offset += 20) {
      await Promise.all(entries.slice(offset, offset + 20).map(async ([email, item]) => {
        const ref = db.collection('imwebMarketingConsents').doc(consentEmailId(email));
        const data = {
            email, imwebMemberCodes: item.codes, marketingConsentSource: 'imweb', consentSchemaVersion: 2,
            marketingEmailConsent: item.email.length ? !item.email.includes(false) : null,
            marketingSmsConsent: item.sms.length ? !item.sms.includes(false) : null,
            syncedAt: now
        };
        await db.runTransaction(async tx => {
            const previous = (await tx.get(ref)).data();
            tx.set(ref, data);
            if (!previous || previous.marketingEmailConsent !== data.marketingEmailConsent || previous.marketingSmsConsent !== data.marketingSmsConsent) {
                tx.set(ref.collection('history').doc(), { ...data, previousEmail: previous?.marketingEmailConsent ?? null, previousSms: previous?.marketingSmsConsent ?? null });
            }
        });
        // Include members who have never purchased or signed into the app.
        const customerRef = db.collection('customers').doc(`imweb-${consentEmailId(email)}`);
        const existing = await db.collection('customers').where('emails', 'array-contains', email).limit(1).get();
        const legacy = existing.empty ? await db.collection('customers').where('email', '==', email).limit(1).get() : existing;
        if (existing.empty && legacy.empty) await db.runTransaction(async tx => {
            if ((await tx.get(customerRef)).exists) return;
            tx.create(customerRef, { templateId: 'lifeUp', emails: [email], email, source: 'imweb-member', createdAt: now, updatedAt: now });
        });
      }));
    }
    // A removed member must not retain an old positive snapshot.
    const previous = await db.collection('imwebMarketingConsents').get();
    for (const doc of previous.docs) {
        if (!grouped.has(String(doc.data().email))) await doc.ref.set({ marketingEmailConsent: false, marketingSmsConsent: false, syncedAt: now, memberMissing: true }, { merge: true });
    }
    await db.collection('integrationSync').doc('imwebMarketingConsents').set({ lastSuccessAt: now, members: seen.size, emails: grouped.size, schedule: '0 4 * * *', timeZone: 'Asia/Seoul' });
    return { members: seen.size, emails: grouped.size };
}
