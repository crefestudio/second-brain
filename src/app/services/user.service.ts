// src/app/services/user.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { collection, query, where, getDocs, getDoc, deleteDoc, Timestamp, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
const SB_USER_ID_KEY = 'sb_user_id';

import { _log } from '../lib/cf-common/cf-common';

export interface SecondBrainClient {
    clientId: string;        // "24964e09-0f43-4163-8025-ac9bbcf02214"
    origin: string;          // "http://localhost:4200"
    userAgent: string;       // browser UA
    //revoked: boolean;        // false

    createdAt: Timestamp;    // Firestore timestamp
    lastAccessAt: Timestamp; // Firestore timestamp
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


const functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';
@Injectable({
    providedIn: 'root',
})
export class UserService {
    private functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';
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

    async getSecondBrainClient(
        userId: string,
        clientId: string,
        clientKey: string
    ): Promise<SecondBrainClient | null> {
        if (!userId || !clientId || !clientKey) return null;

        try {
            const result = await firstValueFrom(
                this.http.post<SecondBrainClient> (
                    `${this.functionsBaseUrl}/getSecondBrainClient`,
                    { userId, clientId },
                    {
                        headers: { 
                            'Authorization': `Bearer ${clientKey}`
                        }
                    }
                )
            );
            return result;
        } catch (error: any) {
            console.error('getSecondBrainClient failed', error.error?.error || error.message);
            return null;
        }
    }

    /*
    verifyClientKey     아직 구현 안함 / getSecondBrainClient 이거 호출 하면 clientKey 유효성 체크됨



    */
    /////////////////////////////////////////////////////////////////////////////////////
    // userId + clientId로 secondbrain > clients > {clientId} 삭제

    // static async deleteSecondBrainClient( userId: string, clientId: string): Promise<boolean> {
    //     if (!userId || !clientId) return false;

    //     const docRef = doc(
    //         firestore,
    //         'users',
    //         userId,
    //         'integrations',
    //         'secondbrain',
    //         'clients',
    //         clientId
    //     );

    //     const docSnap = await getDoc(docRef);
    //     if (!docSnap.exists()) return false;
    //     await deleteDoc(docRef);
    //     return true;
    // }
   
    static async deleteSecondBrainClientKey(
        userId: string,
        clientId: string
        ): Promise<boolean> {
        if (!userId || !clientId) return false;

        const docRef = doc(
            firestore,
            'users',
            userId,
            'integrations',
            'secondbrain',
            'clients',
            clientId
        );

        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return false;

        // clientKey 필드만 삭제
        await updateDoc(docRef, {
            clientKey: deleteField(),
            expiresAt: deleteField()
        });

        return true;
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
    async verifyCode(email: string, code: string): Promise<{ userId: string; clientId: string } | null> {
        if (!email || !code) return null;

        try {
            const result = await firstValueFrom(
                this.http.post<{ userId: string; clientId: string }>(
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
