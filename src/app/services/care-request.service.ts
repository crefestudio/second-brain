import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type CareRequest = { id: string; type: string; title: string; content: string; status: string; creditHours: number; ownerEmail: string; createdAt: number | null; updatedAt: number | null; };
export type CareAttachment = { id: string; name: string; size: number };
export type CareMessage = { id: string; authorRole: 'user' | 'admin'; authorEmail: string; content: string; createdAt: number | null; attachments?: CareAttachment[] };

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

    async create(type: string, title: string, content: string, files: File[] = []) {
        const attachments = await Promise.all(files.map(file => new Promise<{ name: string; data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('첨부파일을 읽지 못했습니다.'));
            reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(',')[1] });
            reader.readAsDataURL(file);
        })));
        return this.post<{ id: string }>('createCareRequest', { type, title, content, attachments });
    }
    async download(requestId: string, attachment: CareAttachment) {
        const result = await this.post<{ data: string }>('downloadCareAttachment', { requestId, attachmentId: attachment.id });
        const bytes = Uint8Array.from(atob(result.data), character => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    access() { return this.post<{ isAdmin: boolean; email: string; isPremium: boolean }>('getCareAccess', {}); }
    list(adminView = false) { return this.post<{ isAdmin: boolean; requests: CareRequest[] }>('listCareRequests', { adminView }); }
    get(requestId: string) { return this.post<{ isAdmin: boolean; request: CareRequest; messages: CareMessage[] }>('getCareRequest', { requestId }); }
    send(requestId: string, content: string, adminView = false) { return this.post<{ success: boolean }>('sendCareMessage', { requestId, content, adminView }); }
}
