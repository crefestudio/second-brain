// src/app/services/user.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getFirestore, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
const SB_USER_ID_KEY = 'sb_user_id';

import { _log } from '../lib/cf-common/cf-common';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';
    constructor(private http: HttpClient) {}

    // 1. 구매자인지 확인
    async isPremiumPurchaser(phoneNumber: string): Promise<boolean> {
        try {
            // 1️⃣ 해당 전화번호로 doc 조회
            const normalized = phoneNumber.replace(/\D/g, '');
            const docRef = doc(firestore, 'purchasers', normalized);
            const docSnap = await getDoc(docRef);

            //_log('docSnap =>', docSnap)

            // 2️⃣ 문서 없으면 false
            if (!docSnap.exists()) return false;

            // 3️⃣ purchasedTemplateId 확인
            const data: any = docSnap.data();
            return data?.purchasedTemplateId === 'lifeup1.0';
        } catch (error) {
            console.error('구매자 확인 중 오류:', error);
            return false;
        }
    }

    /**
    * 전화번호로 userId 가져오기
    */
    async getUserIdByPhoneNumber(phoneNumber: string): Promise<string | null> {
        const usersCol = collection(firestore, 'users');
        const q = query(usersCol, where('phoneNumber', '==', phoneNumber));
        const querySnap = await getDocs(q);

        if (querySnap.empty) return null;

        // 여러 개 나올 수도 있지만, 보통 1개만
        const docSnap = querySnap.docs[0];
        return docSnap.id; // 문서 ID(userId) 반환
    }

    /**
    * userId로 integration/secondbrain 연결 정보 가져오기
    */
    async getSecondBrainIntegration(userId: string): Promise<any | null> {
        if (!userId) return null;

        const docRef = doc(firestore, 'users', userId, 'integrations', 'secondbrain');
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return docSnap.data(); // { botId, connectedAt, ... }
    }    

    /**
     * 전화번호 기반으로 연결 정보 가져오기
     */
    async getUserInfoByPhoneNumber(phoneNumber: string): Promise<any | null> {
        _log('getUserInfoByPhoneNumber phoneNumber =>', phoneNumber);
        const userId = await this.getUserIdByPhoneNumber(phoneNumber);
        _log('getUserInfoByPhoneNumber userId =>', userId);
        if (!userId) return { userId: '', integration: null };
        let integration = await this.getSecondBrainIntegration(userId);
        return { userId: userId, integration: integration }
    }   

    

    // 2. 연결된 적이 있는 지 확인
    // async getUserByPhoneNumber(phoneNumber: string): Promise<string | null> {
    //     try {
    //         const url = `${this.functionsBaseUrl}/getUserByPhone?phone=${encodeURIComponent(phoneNumber)}`;
    //         const res = await firstValueFrom(this.http.get<any>(url));

    //         // 서버에서 { userId: 'xxx' } 형태로 내려준다고 가정
    //         return res?.userId ?? null;
    //     } catch (e) {
    //         console.error('getUserByPhoneNumber failed', e);
    //         return null;
    //     }
    // }

    static async memberJoinWIthPhoneNumber(phoneNumber: string): Promise<string> {
        let userId = localStorage.getItem(SB_USER_ID_KEY);

        if (!userId) {
            userId = uuidv4();
            localStorage.setItem(SB_USER_ID_KEY, userId);
        }

        await setDoc(
            doc(firestore, 'users', userId),
            {
                phoneNumber: phoneNumber,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
            },
            { merge: true }
        );
        return userId;
    }

    static getUserId(): string | null {
        return localStorage.getItem(SB_USER_ID_KEY);
    }

    // secondbrain api 연결 정보 가져오기
    async getUserSecondBrainConnectInfo(userId: string): Promise<any | null> {
        if (!userId) return null;

        try {
            const url = `${this.functionsBaseUrl}/getUserSecondBrainConnectInfo?userId=${userId}`;
            const data: any = await firstValueFrom(this.http.get<any>(url));

            // 연결 정보가 없는 경우 (서버 기준)
            if (!data || !data.botId) {
                return null;
            }

            return data;
        } catch (error) {
            console.error('getUserConnectedInfo failed', error);
            return null;
        }
    }   
           
    
}
