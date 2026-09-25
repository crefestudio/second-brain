import { createHash, randomInt, randomUUID } from 'crypto';
import { nanoid } from 'nanoid';
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
    purchase: (email: string) => Promise<Purchase | null>;
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
        async request(value: unknown, ip: string): Promise<void> {
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
                tx.set(ref, { requestId, codeHash: digest(key + ':' + code), expiresAt: now + 600000,
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
                return true;
            });
            if (!accepted) throw new PurchaseLoginError(401, '인증번호가 틀리거나 만료되었습니다. 다시 요청해주세요.');
            const purchase = await deps.purchase(email);
            if (!purchase) throw new PurchaseLoginError(403, '유료 라이프업 구매 내역을 찾지 못했습니다. 구매 이메일을 확인해주세요.');

            const query = db.collection('users').where('email', '==', email).limit(2);
            const matches = await query.get();
            if (matches.size > 1) throw new PurchaseLoginError(409, '중복된 계정이 있습니다. 관리자에게 문의해주세요.');
            const existing = matches.docs[0];
            let account: admin.auth.UserRecord;
            if (existing?.data().firebaseUid) {
                // Preserve the existing Google account and all workspace ownership rules.
                account = await auth.getUser(existing.data().firebaseUid);
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
            if (account.disabled) throw new PurchaseLoginError(403, '사용이 중지된 계정입니다. 관리자에게 문의해주세요.');
            const uid = account.uid;
            const userId = existing?.id || nanoid(6);
            const workspaceRef = db.collection('users').doc(userId);
            const accountRef = db.collection('appAccounts').doc(uid);
            await db.runTransaction(async tx => {
                const [currentMatches, workspace, binding] = await Promise.all([
                    tx.get(query), tx.get(workspaceRef), tx.get(accountRef)
                ]);
                const currentWorkspace = workspace.data() || {};
                const currentBinding = binding.data() || {};
                if (currentBinding.deletionStatus === 'pending') throw new PurchaseLoginError(409, '회원 탈퇴 처리 중입니다.');
                // A randomly generated widget address must never overwrite another workspace.
                if (!existing && workspace.exists) {
                    throw new PurchaseLoginError(409, '워크스페이스 주소가 중복되었습니다. 다시 인증해주세요.');
                }
                if (currentMatches.docs.some(doc => doc.id !== userId) ||
                    (currentWorkspace.firebaseUid && currentWorkspace.firebaseUid !== uid) ||
                    (currentBinding.userId && currentBinding.userId !== userId)) {
                    throw new PurchaseLoginError(409, '다른 계정 연결이 확인되었습니다. 관리자에게 문의해주세요.');
                }
                tx.set(workspaceRef, { email, firebaseUid: uid, memberType: purchase.memberType,
                    ...(!workspace.exists ? { createdAt: new Date() } : {}) }, { merge: true });
                tx.set(accountRef, { userId }, { merge: true });
                tx.set(workspaceRef.collection('purchases').doc('lifeUp'), {
                    verified: true, ...purchase, verifiedAt: new Date()
                }, { merge: true });
            });
            // The widget key and unverified memberUID never enter this login flow.
            return { token: await auth.createCustomToken(uid) };
        }
    };
}
