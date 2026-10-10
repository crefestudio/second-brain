import { createHash, randomInt, randomUUID } from 'crypto';
import { bindWorkspacePurchase, workspaceTemplate, WorkspaceConflict } from './workspace-purchase';
import type * as admin from 'firebase-admin';

export class PurchaseLoginError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

interface Purchase {
    purchaser: Record<string, unknown>;
    purchaserIds: string[];
    memberType: string;
}

interface Dependencies {
    db: admin.firestore.Firestore;
    auth: admin.auth.Auth;
    send: (email: string, code: string) => Promise<void>;
    purchase: (email: string, templateId: 'lifeUp' | 'lifeUpScrapbook') => Promise<Purchase | null>;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function emailAddress(value: unknown): string {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        throw new PurchaseLoginError(400, '올바른 구매 이메일을 입력해주세요.');
    }
    return value.trim().toLowerCase();
}

// Separate challenges from the widget's email_verifications/accessKey flow.
export function createPurchaseLogin(deps: Dependencies) {
    const { db, auth } = deps;
    return {
        async request(value: unknown, ip: string, templateId: 'lifeUp' | 'lifeUpScrapbook' = 'lifeUp'): Promise<void> {
            const email = emailAddress(value);
            const key = digest(email);
            const ref = db.collection('appLoginChallenges').doc(key);
            const rateRef = db.collection('appLoginRateLimits').doc(digest(ip || 'unknown'));
            const now = Date.now();
            const code = randomInt(100000, 1000000).toString();
            const requestId = randomUUID();
            await db.runTransaction(async tx => {
                const [challenge, rate] = await Promise.all([tx.get(ref), tx.get(rateRef)]);
                const previous = challenge.data() || {};
                const previousRate = rate.data() || {};
                const requests = previous.windowStartedAt > now - 3600000 ? previous.requests : 0;
                const ipRequests = previousRate.windowStartedAt > now - 3600000 ? previousRate.requests : 0;
                if (previous?.sentAt > now - 60000 || requests >= 5 || ipRequests >= 30) {
                    throw new PurchaseLoginError(429, '인증번호 요청이 많습니다. 잠시 후 다시 시도해주세요.');
                }
                tx.set(ref, { requestId, templateId, codeHash: digest(key + ':' + code), expiresAt: now + 600000,
                    attempts: 0, sentAt: now, requests: requests + 1,
                    windowStartedAt: requests ? previous.windowStartedAt : now, consumed: false });
                tx.set(rateRef, { requests: ipRequests + 1,
                    windowStartedAt: ipRequests ? previousRate.windowStartedAt : now });
            });
            try { await deps.send(email, code); }
            catch (error) {
                await db.runTransaction(async tx => {
                    if ((await tx.get(ref)).data()?.requestId === requestId) tx.update(ref, { consumed: true });
                });
                throw error;
            }
        },
        async verify(value: unknown, input: unknown): Promise<{ token: string }> {
            const email = emailAddress(value);
            if (typeof input !== 'string' || !/^\d{6}$/.test(input.trim())) {
                throw new PurchaseLoginError(400, '6자리 인증번호를 입력해주세요.');
            }
            const key = digest(email);
            const ref = db.collection('appLoginChallenges').doc(key);
            // Commit failed-attempt counts, and consume a correct code atomically.
            const accepted = await db.runTransaction(async tx => {
                const data = (await tx.get(ref)).data();
                if (!data || data.consumed || data.expiresAt <= Date.now() || data.attempts >= 5) return false;
                if (data.codeHash !== digest(key + ':' + input.trim())) {
                    tx.update(ref, { attempts: data.attempts + 1 });
                    return false;
                }
                tx.update(ref, { consumed: true, codeHash: '' });
                return data.templateId === 'lifeUpScrapbook' ? 'lifeUpScrapbook' as const : 'lifeUp' as const;
            });
            if (!accepted) throw new PurchaseLoginError(401, '인증번호가 틀리거나 만료되었습니다. 다시 요청해주세요.');
            const templateId = accepted;
            const purchase = await deps.purchase(email, templateId);
            if (!purchase) throw new PurchaseLoginError(403, '유료 라이프업 구매 내역을 찾지 못했습니다. 구매 이메일을 확인해주세요.');

            const matches = await db.collection('users').where('email', '==', email).get();
            const candidates = matches.docs.filter(doc => workspaceTemplate(doc.data()) === templateId);
            if (candidates.length > 1) throw new PurchaseLoginError(409, '중복된 워크스페이스가 있습니다. 관리자에게 문의해주세요.');
            const existing = candidates[0];
            // Legacy links may point at a different login email. Never issue
            // that account's token merely because its purchase email was verified.
            const relatedOwners = [...new Set(matches.docs.map(doc => doc.data().firebaseUid as string).filter(Boolean))];
            const boundUid = existing?.data().firebaseUid || (relatedOwners.length === 1 ? relatedOwners[0] : '');
            if (!boundUid && relatedOwners.length > 1)
                throw new PurchaseLoginError(409, '구매 이메일이 여러 계정에 연결되어 있습니다. 사용할 계정으로 로그인 후 인증해주세요.');
            let account: admin.auth.UserRecord;
            if (boundUid) {
                account = await auth.getUser(boundUid);
            } else {
                try { account = await auth.getUserByEmail(email); }
                catch (error) {
                    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
                    try { account = await auth.createUser({ email, emailVerified: true }); }
                    catch (creationError) {
                        if ((creationError as { code?: string }).code !== 'auth/email-already-exists') throw creationError;
                        account = await auth.getUserByEmail(email);
                    }
                }
            }
            if (account.disabled) throw new PurchaseLoginError(403, '사용이 중지된 계정입니다.');
            if (!account.email || account.email.trim().toLowerCase() !== email)
                throw new PurchaseLoginError(409, '이 구매는 다른 이메일의 계정에 연결되어 있습니다. 관리자에게 구매 연결 정리를 요청해주세요.');
            if (!account.emailVerified) await auth.updateUser(account.uid, { emailVerified: true });
            const uid = account.uid;
            try { await bindWorkspacePurchase(db, uid, email, templateId, { ...purchase }); }
            catch (error) {
                if (error instanceof WorkspaceConflict) throw new PurchaseLoginError(409, error.message);
                throw error;
            }
            // The widget key and unverified memberUID never enter this login flow.
            return { token: await auth.createCustomToken(uid) };
        }
    };
}
