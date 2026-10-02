import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export interface MailQueueItem {
    id: string; subject: string; recipient: string; priority: string; status: string;
    createdAt: number; sentAt?: number; nextAttemptAt?: number; lastError?: string; queueOrder?: number;
}
export interface MailQueuePage { items: MailQueueItem[]; usage: Record<string, number>; limits: Record<string, number>; nextMorning: number }
@Injectable({ providedIn: 'root' })
export class MailAdminService {
    private baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async list(before?: number, beforeId?: string): Promise<MailQueuePage> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/listMailQueue`, { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ before, beforeId }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '메일 목록을 불러오지 못했습니다.');
        return body;
    }
    async cancel(id: string): Promise<void> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/cancelMailQueueItem`, { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '메일 발송 취소에 실패했습니다.');
    }
}
