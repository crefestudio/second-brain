import { createHash, randomBytes } from 'crypto';
import { firestore } from 'firebase-admin';

const { FieldValue } = firestore;

export class InvitationError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export function createPurchaseInvitations(db: firestore.Firestore, formatDate: (date: string) => string) {
    const invitations = db.collection('purchaseInvitations');
    const tokenKey = (token: unknown): string => {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new InvitationError(404, '유효한 초대 링크가 아닙니다.');
        return createHash('sha256').update(token).digest('hex');
    };
    const check = (data: FirebaseFirestore.DocumentData | undefined) => {
        if (!data) throw new InvitationError(404, '초대장을 찾을 수 없습니다.');
        if (data.status !== 'redeemed' && (data.status !== 'pending' || data.expiresAt <= Date.now())) {
            throw new InvitationError(410, '만료되었거나 취소된 초대장입니다. 관리자에게 새 링크를 요청해주세요.');
        }
        return data;
    };
    return {
        async create(emailValue: unknown, memberType: unknown, createdBy: string) {
            const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
            if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvitationError(400, '이메일을 확인해주세요.');
            if (memberType !== 'standard' && memberType !== 'premium') throw new InvitationError(400, '회원 등급을 선택해주세요.');
            const token = randomBytes(32).toString('hex');
            const expiresAt = Date.now() + 30 * 86400000;
            await invitations.doc(tokenKey(token)).create({ email, memberType, createdBy, expiresAt,
                status: 'pending', createdAt: FieldValue.serverTimestamp() });
            return { token, email, memberType, expiresAt };
        },
        async inspect(token: unknown) {
            const data = check((await invitations.doc(tokenKey(token)).get()).data());
            return { email: data.email, memberType: data.memberType, redeemed: data.status === 'redeemed', expiresAt: data.expiresAt };
        },
        async redeem(token: unknown, nameValue: unknown, phoneValue: unknown) {
            const key = tokenKey(token);
            const ref = invitations.doc(key);
            const purchaseRef = db.collection('purchasers').doc(`invitation_${key}`);
            const name = typeof nameValue === 'string' ? nameValue.trim() : '';
            const phone = typeof phoneValue === 'string' ? phoneValue.trim() : '';
            if (!name || name.length > 80 || [...name].some(character => character.charCodeAt(0) < 32)) throw new InvitationError(400, '이름을 입력해주세요. (80자 이내)');
            if (phone.length > 30 || !/^\+?[0-9 ()-]+$/.test(phone) || !/^\d{9,15}$/.test(phone.replace(/\D/g, ''))) throw new InvitationError(400, '전화번호를 확인해주세요.');
            return db.runTransaction(async tx => {
                const data = check((await tx.get(ref)).data());
                if (data.status === 'redeemed') return { success: true, alreadyRegistered: true };
                // Email, tier and price are exclusively server-owned. The link never
                // creates a session; the recipient must verify email to sign in.
                tx.create(purchaseRef, {
                    templateId: 'lifeUp', email: data.email, name, phone,
                    memberType: data.memberType, amount: '1원', notify: '미응답',
                    purchaseOption: `라이프업 1.5 ${data.memberType === 'premium' ? '프리미엄' : '일반'} 초대장`,
                    purchasedAt: formatDate(new Date().toISOString()), status: '결제 완료',
                    paymentMethod: '초대장 (실제 결제 없음)', source: 'invitation', registrationStatus: 'invitation',
                    purchaseEligible: true, upgradeOnly: false,
                    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
                });
                tx.update(ref, { status: 'redeemed', redeemedAt: FieldValue.serverTimestamp(), purchaserId: purchaseRef.id });
                return { success: true, alreadyRegistered: false };
            });
        }
    };
}
