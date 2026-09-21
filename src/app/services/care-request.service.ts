import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type CareRequest = { id: string; type: string; title: string; content: string; status: string; creditHours: number; ownerEmail: string; createdAt: number | null; updatedAt: number | null; };
export type CareMessage = { id: string; authorRole: 'user' | 'admin'; authorEmail: string; content: string; createdAt: number | null; };

@Injectable({ providedIn: 'root' })
export class CareRequestService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;

    private async post<T>(path: string, body: unknown): Promise<T> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({ error: '서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' }));
        if (!response.ok) throw new Error(payload.error || '요청 처리에 실패했습니다.');
        return payload as T;
    }

    create(type: string, title: string, content: string) { return this.post<{ id: string }>('createCareRequest', { type, title, content }); }
    access() { return this.post<{ isAdmin: boolean; email: string }>('getCareAccess', {}); }
    list(adminView = false) { return this.post<{ isAdmin: boolean; requests: CareRequest[] }>('listCareRequests', { adminView }); }
    get(requestId: string) { return this.post<{ isAdmin: boolean; request: CareRequest; messages: CareMessage[] }>('getCareRequest', { requestId }); }
    send(requestId: string, content: string) { return this.post<{ success: boolean }>('sendCareMessage', { requestId, content }); }
}
