// src/app/services/user.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firestore } from '../firebase';
import {
    doc, updateDoc, deleteField, collection, query, where, getDocs, setDoc, getDoc, deleteDoc, Timestamp, limit, onSnapshot, serverTimestamp, orderBy,
    startAfter, QueryDocumentSnapshot, DocumentData, getCountFromServer
} from 'firebase/firestore';

import { firstValueFrom, Subject, Subscription } from 'rxjs';
const SB_USER_ID_KEY = 'sb_user_id';


import { _log } from '../lib/cf-common/cf-common';

export interface SecondBrainUser {
    userId: string
    // clientId: string;        // "24964e09-0f43-4163-8025-ac9bbcf02214"
    // origin: string;          // "http://localhost:4200"
    // userAgent: string;       // browser UA
    // //revoked: boolean;        // false

    createdAt: Timestamp;    // Firestore timestamp
    // lastAccessAt: Timestamp; // Firestore timestamp
}

export interface Node {
    id: string;
    label: string;
    group?: string;
}

export interface Edge {
    from: string;
    to: string;
    weight?: number;
}

export interface SecondBrainLocalSession {
    userId: string;
    accessKey: string;
}


const functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';
@Injectable({
    providedIn: 'root',
})
export class UserService {
    private functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';

    public kakaoVerified$ = new Subject<void>();
    private verificationUnsubscribe?: () => void;

    public notionConnected$ = new Subject<void>();
    private notionConnectUnsubscribe?: () => void;

    constructor(private http: HttpClient) { }
    /////////////////////////////////////////////////////////////////////////////////////
    //  firebase 직접 호출


    /////////////////////////////////////////////////////////////////////////////////////
    // userId로 integration/secondbrain 연결 정보 가져오기

    static async getSecondBrainIntegration(userId: string): Promise<any | null> {
        if (!userId) return null;

        const docRef = doc(firestore, 'users', userId, 'integrations', 'secondbrain');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return docSnap.data(); // { botId, connectedAt, ... }
    }

    static async getUserIntegrationInfo(userId: string, integrationId: string): Promise<any | null> {
        if (!userId || !integrationId) return null;

        const docRef = doc(
            firestore,
            'users',
            userId,
            'integrations',
            integrationId
        );

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return docSnap.data();
    }

    static async getUserIntegrations(userId: string): Promise<Record<string, any>> {
        if (!userId) return {};

        const colRef = collection(
            firestore,
            'users',
            userId,
            'integrations'
        );

        const snapshot = await getDocs(colRef);
        const integrations: Record<string, any> = {};

        snapshot.forEach(doc => {
            integrations[doc.id] = doc.data();
        });

        return integrations;
    }

    // users/zNkqIoVU/integrations/secondbrain
    static async removeSecondBrainIntegration(userId: string): Promise<boolean> {
        if (!userId) return false;

        const docRef = doc(firestore, 'users', userId, 'integrations', 'secondbrain');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return false;

        await deleteDoc(docRef);
        return true;
    }

    async disconnectNotionTemplate(userId: string): Promise<boolean> {
        try {
            if (!userId) return false;

            const docRef = doc(
                firestore,
                'users',
                userId
            );

            await updateDoc(docRef, {
                notionAccessToken: deleteField(),
                notionConnection: deleteField(),
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('disconnectNotionTemplate error:', error);
            return false;
        }
    }

    static async getUser(userId: string): Promise<any | null> {
        if (!userId) return null;

        const docRef = doc(firestore, 'users', userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return {
            id: docSnap.id,
            ...docSnap.data(),
        };
    }

    // async getSecondBrainClient(
    //     userId: string,
    //     clientId: string,
    //     clientKey: string
    // ): Promise<SecondBrainClient | null> {
    //     if (!userId || !clientId || !clientKey) return null;

    //     try {
    //         const result = await firstValueFrom(
    //             this.http.post<SecondBrainClient> (
    //                 `${this.functionsBaseUrl}/getSecondBrainClient`,
    //                 { userId, clientId },
    //                 {
    //                     headers: { 
    //                         'Authorization': `Bearer ${clientKey}`
    //                     }
    //                 }
    //             )
    //         );
    //         return result;
    //     } catch (error: any) {
    //         console.error('getSecondBrainClient failed', error.error?.error || error.message);
    //         return null;
    //     }
    // }

    async checkUserAccessKey(
        userId: string,
        accessKey: string
    ): Promise<SecondBrainUser | null> {
        if (!userId || !accessKey) return null;

        try {
            const result = await firstValueFrom(
                this.http.post<SecondBrainUser>(
                    `${this.functionsBaseUrl}/checkUserAccessKey`,
                    { userId },
                    {
                        headers: {
                            'Authorization': `Bearer ${accessKey}`
                        }
                    }
                )
            );
            return result;
        } catch (error: any) {
            console.error('checkUserAccessKey failed', error.error?.error || error.message);
            return null;
        }
    }


    /////////////////////////////////////////////////////////////////////////////////////
    //  localstorage


    static getUserId(): string | null {
        return localStorage.getItem(SB_USER_ID_KEY);
    }

    /////////////////////////////////////////////////////////////////////////////////////
    //  firebase functions

    /*
        main verify
    */

    async sendVerificationEmail(email: string): Promise<boolean> {
        if (!email) return false;

        try {
            await firstValueFrom(
                this.http.post(`${this.functionsBaseUrl}/sendVerificationEmail`, { email })
            );
            return true;
        } catch (error) {
            console.error('sendVerificationEmail failed', error);
            return false;
        }
    }

    // 인증번호 확인
    async verifyCode(email: string, code: string): Promise<{ userId: string, accessKey: string, message?: string } | null> {
        if (!email || !code) return null;

        try {
            const result = await firstValueFrom(
                this.http.post<{ userId: string; accessKey: string }>(
                    `${this.functionsBaseUrl}/verifyCode`,
                    { email, code }
                )
            );
            return result;
        } catch (error: any) {
            console.error('verifyCode failed', error.error?.error || error.message);
            return null;
        }
    }

    async generateNotionNoteKMDataBatch(userId: string): Promise<boolean> {
        if (!userId) return false;

        try {
            await firstValueFrom(
                this.http.post(`${this.functionsBaseUrl}/generateNotionNoteKMDataBatch`, { userId })
            );
            return true;
        } catch (error) {
            console.error('generateNotionNoteKMDataBatch failed', error);
            return false;
        }
    }

    // async generateNoteConcepts(userId: string): Promise<boolean> {
    //     if (!userId) return false;

    //     try {
    //         await firstValueFrom(
    //             this.http.post(`${this.functionsBaseUrl}/generateNoteConcepts`, { userId })
    //         );
    //         return true;
    //     } catch (error) {
    //         console.error('generateNoteConcepts failed', error);
    //         return false;
    //     }
    // }

    async getKeywordGraphData(
        userId: string,
        graphType: string
    ): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
        if (!userId) return null;

        try {
            // HTTP POST 호출 및 결과 받기
            const result = await firstValueFrom(
                this.http.post<{ nodes: Node[]; edges: Edge[] }>(
                    `${this.functionsBaseUrl}/getKeywordGraphData`,
                    { userId, graphType }
                )
            );

            // 성공 시 { nodes, edges } 반환
            return result;

        } catch (error) {
            console.error("getKeywordGraphData failed", error);
            return null; // 실패 시 null 반환
        }
    }

    async verifyPurchaser(templateId: string, email?: string, phone?: string, userId?: string): Promise<boolean> {
        if (!templateId || (!email && !phone)) {
            return false;
        }

        try {
            const result = await firstValueFrom(
                this.http.post<any>(
                    `${this.functionsBaseUrl}/verifyPurchaser`,
                    { templateId, email, phone }
                )
            );

            if (!result?.purchaser) {
                return false;
            }

            // localStorage 저장
            const STORAGE_KEY = 'notionable_verified_purchases';
            const purchases = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || '{}'
            );
            purchases[templateId] = {
                ...result.purchaser,
                verifiedAt: Date.now()
            };
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(purchases)
            );
            return true;
        } catch (error: any) {

            console.error(
                'verifyPurchaser failed',
                error.error?.message || error.message
            );

            return false;
        }
    }

    static async savePurchaserInfo(
        userId: string,
        templateId: string,
        purchaser: any
    ): Promise<void> {
        if (!userId) {
            throw new Error('userId is required.');
        }

        if (!templateId) {
            throw new Error('templateId is required.');
        }

        if (!purchaser) {
            throw new Error('purchaser is required.');
        }

        await setDoc(
            doc(firestore, 'users', userId, 'purchases', templateId),
            {
                verified: true,
                purchaser,
                verifiedAt: serverTimestamp()
            },
            { merge: true }
        );
    }
    // static async isPurchased(
    //     userId: string,
    //     templateId: string
    // ): Promise<boolean> {

    //     if (!userId || !templateId) {
    //         return false;
    //     }

    //     const purchaseRef = doc(
    //         firestore,
    //         'users',
    //         userId,
    //         'purchases',
    //         templateId
    //     );

    //     const purchaseSnap = await getDoc(purchaseRef);

    //     return purchaseSnap.exists();
    // }

    static async getPurchaseInfo(
        userId: string,
        templateId: string
    ): Promise<any | null> {

        if (!userId || !templateId) {
            return null;
        }

        const purchaseRef = doc(
            firestore,
            'users',
            userId,
            'purchases',
            templateId
        );

        const purchaseSnap = await getDoc(purchaseRef);

        if (!purchaseSnap.exists()) {
            return null;
        }

        const data: any = purchaseSnap.data();
        return {
            templateId: purchaseSnap.id,
            ...data?.purchaser ?? null,
            verified: data.verified
        };
    }

    static getPurchaseInfoFromLocalstorage(templateId: string): any | undefined {
        const STORAGE_KEY = "notionable_verified_purchases";

        const purchases = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "{}"
        );

        return purchases[templateId];
    }

    //import { deleteDoc, doc } from 'firebase/firestore';

    static async deletePurchase(userId: string, templateId: string): Promise<void> {
        const purchaseRef = doc(
            firestore,
            'users',
            userId,
            'purchases',
            templateId
        );
        await deleteDoc(purchaseRef);
    }

    static saveLocalSession(userId: string, session: SecondBrainLocalSession): void {
        localStorage.setItem(
            userId,
            JSON.stringify(session)
        );
    }

    static getLocalSession(userId: string): SecondBrainLocalSession | null {
        // const clientKey = localStorage.getItem(clientId);
        // _log('getLocalSession clientKey =>', clientKey);
        // if (!clientKey) return null;

        let raw = localStorage.getItem(userId);
        _log('getLocalSession raw =>', raw);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            _log('getLocalSession parsed =>', parsed);

            // 구조 체크
            if (
                typeof parsed !== 'object' ||
                !parsed.userId || !parsed.accessKey
            ) {
                return null;
            }

            _log('getLocalSession parsed2 =>', parsed);

            return {
                userId: parsed.userId ? String(parsed.userId) : '',
                accessKey: parsed.accessKey ? String(parsed.accessKey) : ''
            };
        } catch {
            return null;
        }
    }

    static clearLocalSession(userId: string): void {
        localStorage.removeItem(userId);
    }

    static async saveImwebMemberId(userId: string, imwebMemberId: string): Promise<void> {
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
            imwebMemberId,
            updatedAt: serverTimestamp()
        });
    }

    static async getUserByImwebMemberId(
        imwebMemberId: string
    ): Promise<{ userId: string; kakaoUserId: string; notionAccessToken: string | null } | null> {

        const q = query(
            collection(firestore, 'users'),
            where('imwebMemberId', '==', imwebMemberId),
            limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        return {
            userId: doc.id,
            kakaoUserId: data['kakaoUserId'] ?? null,
            notionAccessToken: data['notionAccessToken'] ?? null
        };
    }

    // static async getUserIdByImwebMemberId(imwebMemberId: string): Promise<string | null> {
    //     const q = query(
    //         collection(firestore, 'users'),
    //         where('imwebMemberId', '==', imwebMemberId),
    //         limit(1)
    //     );

    //     const snapshot = await getDocs(q);

    //     if (snapshot.empty) {
    //         return null;
    //     }

    //     return snapshot.docs[0].id;
    // }

    async requestKakaoVerification(userId: string): Promise<{ code: string; expiresAt: any } | null> {
        if (!userId) return null;

        try {
            const result = await firstValueFrom(
                this.http.post<{ code: string; expiresAt: any }>(
                    `${this.functionsBaseUrl}/requestKakaoVerification`,
                    { userId }
                )
            );

            return result;
        } catch (error) {
            console.error('requestKakaoVerification failed', error);
            return null;
        }
    }

    startVerificationWatcher(userId: string) {
        if (!userId) { return; }
        this.stopVerificationWatcher();
        const docRef = doc(
            firestore,
            'verifications',
            userId
        );

        this.verificationUnsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (!snapshot.exists()) { return; }

                const data = snapshot.data();
                if (data['verified']) {
                    this.kakaoVerified$.next();
                    this.stopVerificationWatcher();
                }
            }
        );
    }

    stopVerificationWatcher() {
        this.verificationUnsubscribe?.();
        this.verificationUnsubscribe = undefined;
    }

    async disconnectKakao(userId: string): Promise<boolean> {
        if (!userId) return false;

        try {
            await firstValueFrom(
                this.http.post(
                    `${this.functionsBaseUrl}/disconnectKakao`,
                    { userId }
                )
            );

            return true;

        } catch (error) {
            console.error('disconnectKakao failed', error);
            return false;
        }
    }

    /////////////////////////////////////////////////////////////////
    //
    // notion

    startNotionConnectWatcher(userId: string) {
        if (!userId) { return; }

        this.stopNotionConnectWatcher();

        const docRef = doc(
            firestore,
            'users',
            userId
        );

        this.notionConnectUnsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (!snapshot.exists()) { return; }

                const data = snapshot.data();
                if (data['notionAccessToken']) {
                    this.notionConnected$.next();
                    this.stopNotionConnectWatcher();
                }
            }
        );
    }

    stopNotionConnectWatcher() {
        this.notionConnectUnsubscribe?.();
        this.notionConnectUnsubscribe = undefined;
    }

    static async getUserEvents(
        userId: string,
        agentId: string,
        lastDoc: QueryDocumentSnapshot<DocumentData> | null,
        limitCount: number,
        startDate?: Date | null,
        endDate?: Date | null
    ): Promise<{
        events: any[];
        lastDoc: QueryDocumentSnapshot<DocumentData> | null;
        hasMore: boolean;
    }> {

        if (!userId) {
            return {
                events: [],
                lastDoc: null,
                hasMore: false
            };
        }

        const colRef = collection(
            firestore,
            'users',
            userId,
            'events'
        );

        const constraints: any[] = [];

        // agent
        if (agentId) {
            constraints.push(
                where('agentId', '==', agentId)
            );
        }

        // start date
        if (startDate) {
            constraints.push(
                where('updatedAt', '>=', startDate)
            );
        }

        // end date
        if (endDate) {
            constraints.push(
                where('updatedAt', '<=', endDate)
            );
        }

        // 정렬
        constraints.push(
            orderBy('updatedAt', 'desc')
        );

        // 페이지네이션
        if (lastDoc) {
            constraints.push(
                startAfter(lastDoc)
            );
        }

        constraints.push(
            limit(limitCount)
        );

        const q = query(
            colRef,
            ...constraints
        );

        const snapshot = await getDocs(q);

        return {
            events: snapshot.docs.map(doc => {
                const data: any = doc.data();

                return {
                    id: doc.id,
                    ...data,
                    updatedAt: data.updatedAt?.toDate?.()
                };
            }),
            lastDoc:
                snapshot.docs.length > 0
                    ? snapshot.docs[snapshot.docs.length - 1]
                    : null,
            hasMore:
                snapshot.docs.length === limitCount
        };
    }

    static async getTodayEventCount(userId: string, agentId?: string): Promise<number> {
        if (!userId) {
            return 0;
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const constraints: any[] = [
            where('updatedAt', '>=', start),
            where('updatedAt', '<=', end)
        ];

        if (agentId) {
            constraints.push(
                where('agentId', '==', agentId)
            );
        }

        console.log('[EventCount] userId =', userId);
        console.log('[EventCount] agentId =', agentId);
        console.log('[EventCount] start =', start);
        console.log('[EventCount] end =', end);

        const q = query(
            collection(
                firestore,
                'users',
                userId,
                'events'
            ),
            ...constraints
        );

        const snapshot = await getCountFromServer(q);

        console.log('[EventCount] count =', snapshot.data().count);

        return snapshot.data().count;
    }
    static async updateUserAutomation(
        userId: string,
        agentId: string,
        data: { enabled: boolean; }
    ): Promise<boolean> {

        try {
            if (!userId || !agentId) {
                return false;
            }

            ///////////////////////////////////////////////////
            // integrations 업데이트
            const docRef = doc(
                firestore,
                'users',
                userId,
                'integrations',
                agentId
            );

            await setDoc(
                docRef,
                {
                    enabled: data.enabled,
                    updatedAt: serverTimestamp()
                },
                {
                    merge: true
                }
            );

            ///////////////////////////////////////////////////
            // 카카오 비서라면 캐시 동기화
            if (agentId === 'kakao-capture') {

                const userSnap = await getDoc(
                    doc(firestore, 'users', userId)
                );

                const userData = userSnap.data();
                const kakaoUserId = userData?.['kakaoUserId'];

                if (kakaoUserId) {
                    await setDoc(
                        doc(
                            firestore,
                            'kakaoConnections',
                            kakaoUserId
                        ),
                        {
                            enabled: data.enabled
                        },
                        {
                            merge: true
                        }
                    );
                }
            }

            return true;

        } catch (error) {
            console.error(
                'updateUserAutomation error:',
                error
            );
            return false;
        }
    }
}

/**
     * 전화번호 기반으로 연결 정보 가져오기
     */
// async getUserInfoByPhoneNumber(phoneNumber: string): Promise<any | null> {
//     const normalized = phoneNumber.replace(/\D/g, '');
//     _log('getUserInfoByPhoneNumber normalized =>', normalized);

//     const userId = await UserService.getUserIdByPhoneNumber(normalized);
//     _log('getUserInfoByPhoneNumber userId =>', userId);
//     if (!userId) return { userId: '', integration: null };
//     let integration = await UserService.getSecondBrainIntegration(userId);
//     return { userId: userId, integration: integration }
// }

// static async memberJoinWIthPhoneNumber(phoneNumber: string): Promise<string> {
//     let userId = localStorage.getItem(SB_USER_ID_KEY);

//     if (!userId) {
//         userId = uuidv4();
//         localStorage.setItem(SB_USER_ID_KEY, userId);
//     }

//     await setDoc(
//         doc(firestore, 'users', userId),
//         {
//             phoneNumber: phoneNumber,
//             updatedAt: serverTimestamp(),
//             createdAt: serverTimestamp(),
//         },
//         { merge: true }
//     );
//     return userId;
// }

// secondbrain api 연결 정보 가져오기
// async getUserSecondBrainConnectInfo(userId: string): Promise<any | null> {
//     if (!userId) return null;

//     try {
//         const url = `${this.functionsBaseUrl}/getUserSecondBrainConnectInfo?userId=${userId}`;
//         const data: any = await firstValueFrom(this.http.get<any>(url));

//         // 연결 정보가 없는 경우 (서버 기준)
//         if (!data || !data.botId) {
//             return null;
//         }

//         return data;
//     } catch (error) {
//         console.error('getUserConnectedInfo failed', error);
//         return null;
//     }
// }

// static async saveEmbedInfo(params: {
//     userId: string;
//     embedId: string;
//     origin?: string;
//     userAgent?: string;
// }): Promise<void> {
//     const { userId, embedId, origin, userAgent } = params;

//     const embedRef = doc(
//         firestore,
//         'users',
//         userId,
//         'integrations',
//         'secondbrain',
//         'embeds',
//         embedId
//     );

//     await setDoc(
//         embedRef,
//         {
//             embedId,
//             origin: origin ?? null,
//             userAgent: userAgent ?? null,
//             revoked: false,
//             lastAccessAt: serverTimestamp(),
//             createdAt: serverTimestamp(),
//         },
//         { merge: true } // 이미 있으면 업데이트
//     );
// }

// static async deleteEmbed(userId: string, embedId: string): Promise<void> {
//     const embedRef = doc(
//         firestore,
//         'users',
//         userId,
//         'integrations',
//         'secondbrain',
//         'embeds',
//         embedId
//     );
//     await deleteDoc(embedRef);
// }

// static async createSecondBrainIntegrationData(params: {
//     userId: string;
//     embedId: string;
// }): Promise<{ success: boolean; dbId?: string; message?: string }> {
//     const response = await fetch(
//         `${functionsBaseUrl}/createSecondBrainIntegrationData`,
//         {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify(params),
//         }
//     );

//     if (!response.ok) {
//         throw new Error('서버 요청 실패');
//     }

//     return await response.json();
// }

// 1. 구매자인지 확인
// async isPremiumPurchaser(phoneNumber: string): Promise<boolean> {
//     try {
//         // 1️⃣ 해당 전화번호로 doc 조회
//         const normalized = phoneNumber.replace(/\D/g, '');
//         const docRef = doc(firestore, 'purchasers', normalized);
//         const docSnap = await getDoc(docRef);

//         //_log('docSnap =>', docSnap)

//         // 2️⃣ 문서 없으면 false
//         if (!docSnap.exists()) return false;

//         // 3️⃣ purchasedTemplateId 확인
//         const data: any = docSnap.data();
//         return data?.purchasedTemplateId === 'lifeup1.0';
//     } catch (error) {
//         console.error('구매자 확인 중 오류:', error);
//         return false;
//     }
// }

/**
* 전화번호로 userId 가져오기
*/
// static async getUserIdByPhoneNumber(phoneNumber: string): Promise<string | null> {
//     const normalized = phoneNumber.replace(/\D/g, '');
//     _log('getUserIdByPhoneNumber normalized =>', normalized);
//     const usersCol = collection(firestore, 'users');
//     const q = query(usersCol, where('phoneNumber', '==', normalized));
//     const querySnap = await getDocs(q);

//     if (querySnap.empty) return null;

//     // 여러 개 나올 수도 있지만, 보통 1개만
//     const docSnap = querySnap.docs[0];
//     return docSnap.id; // 문서 ID(userId) 반환
// }
