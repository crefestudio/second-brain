// src/app/services/user.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
const SB_USER_ID_KEY = 'sb_user_id';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private functionsBaseUrl = 'https://us-central1-notionable-secondbrain.cloudfunctions.net';
    constructor(private http: HttpClient) {}

    async checkPhoneExists(phoneNumber: string): Promise<string | null> {
        try {
            const url = `${this.functionsBaseUrl}/getUserByPhone?phone=${encodeURIComponent(phoneNumber)}`;
            const res = await firstValueFrom(this.http.get<any>(url));

            // 서버에서 { userId: 'xxx' } 형태로 내려준다고 가정
            return res?.userId ?? null;
        } catch (e) {
            console.error('checkPhoneExists failed', e);
            return null;
        }
    }

    static async savePhoneNumber(phoneNumber: string): Promise<string> {
        let userId = localStorage.getItem(SB_USER_ID_KEY);

        if (!userId) {
            userId = uuidv4();
            localStorage.setItem(SB_USER_ID_KEY, userId);
        }

        await setDoc(
            doc(firestore, 'users', userId),
            {
                profile: { phoneNumber },
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

    async getUserConnectedInfo(userId: string): Promise<any | null> {
        if (!userId) return null;

        try {
            const url = `${this.functionsBaseUrl}/getUserNotionData?userId=${userId}`;
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
