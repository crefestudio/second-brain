import type * as admin from 'firebase-admin';
import { nanoid } from 'nanoid';

export type WorkspaceTemplate = 'lifeUp' | 'lifeUpScrapbook';
export const workspaceTemplate = (data: { templateId?: string }): WorkspaceTemplate =>
    data.templateId === 'lifeUpScrapbook' ? 'lifeUpScrapbook' : 'lifeUp';

export class WorkspaceConflict extends Error {}

// Account document serializes concurrent claims, including claims using different emails.
export async function bindWorkspacePurchase(db: admin.firestore.Firestore, uid: string, email: string,
    templateId: WorkspaceTemplate, purchase: Record<string, unknown>,
    verification?: { ref: admin.firestore.DocumentReference; hash: string }): Promise<string> {
    const accountRef = db.collection('appAccounts').doc(uid);
    const newId = nanoid(6);
    return db.runTransaction(async tx => {
        const [account, owned, matches] = await Promise.all([
            tx.get(accountRef), tx.get(db.collection('users').where('firebaseUid', '==', uid)),
            tx.get(db.collection('users').where('email', '==', email))
        ]);
        if (account.data()?.deletionStatus === 'pending') throw new WorkspaceConflict('회원 탈퇴 처리 중입니다.');
        const own = owned.docs.filter(doc => workspaceTemplate(doc.data()) === templateId);
        const candidates = matches.docs.filter(doc => workspaceTemplate(doc.data()) === templateId);
        if (own.length > 1 || candidates.length > 1) throw new WorkspaceConflict('같은 템플릿의 워크스페이스가 여러 개 있습니다. 관리자에게 문의해주세요.');
        const candidate = candidates[0];
        if (candidate?.data().firebaseUid && candidate.data().firebaseUid !== uid)
            throw new WorkspaceConflict('이 구매는 이미 다른 계정에 연결되어 있습니다. 기존 계정으로 로그인해주세요.');
        if (own[0] && candidate && own[0].id !== candidate.id)
            throw new WorkspaceConflict('이 계정에는 해당 템플릿의 워크스페이스가 이미 있습니다. 기존 워크스페이스를 선택해주세요.');
        const existing = own[0] || candidate;
        const ref = existing?.ref || db.collection('users').doc(newId);
        if (!existing && (await tx.get(ref)).exists) throw new WorkspaceConflict('워크스페이스 생성 중 충돌했습니다. 다시 시도해주세요.');
        if (verification) {
            const challenge = (await tx.get(verification.ref)).data();
            if (!challenge || (challenge.attempts || 0) >= 5 || challenge.code !== verification.hash || challenge.expiresAt.toMillis() < Date.now() ||
                (challenge.templateId && challenge.templateId !== templateId))
                throw new WorkspaceConflict('인증번호가 만료되었거나 다른 상품의 인증번호입니다. 다시 요청해주세요.');
        }
        tx.set(ref, { email, firebaseUid: uid, templateId,
            ...(templateId === 'lifeUp' ? { memberType: purchase.memberType } : {}),
            ...(!existing ? { createdAt: new Date() } : {}) }, { merge: true });
        tx.set(accountRef, { userId: ref.id,
            ...((purchase.purchaser as {source?: string})?.source === 'invitation' && account.data()?.marketingConsentSource !== 'user'
                ? { invitationMarketingConsentRequired: true } : {})
        }, { merge: true });
        tx.set(ref.collection('purchases').doc(templateId), { ...purchase, verified: true, verifiedAt: new Date() }, { merge: true });
        if (verification) tx.delete(verification.ref);
        return ref.id;
    });
}
