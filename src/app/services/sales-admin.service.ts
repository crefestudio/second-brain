import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type StoreVisitSource = { location: string; count: number; title?: string | null; sourceViews: number | null };
export type StoreVisitSummary = { month: string; totalViews: number; productViews: Record<string, number>; productSales: Record<string, { count: number; revenue: number }>; sources: StoreVisitSource[] };

@Injectable({ providedIn: 'root' })
export class SalesAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async summary(): Promise<StoreVisitSummary> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/getStoreVisitSummary`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '유입 기록을 불러오지 못했습니다.');
        return payload as StoreVisitSummary;
    }
    async syncYoutube(accessToken: string, adminToken: string): Promise<string> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/syncYoutubeMonthlyViews`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ accessToken })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'YouTube 조회수를 불러오지 못했습니다.');
        return payload.message || '조회 결과를 확인했습니다.';
    }
    async resetMonthlyVisits(): Promise<void> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/resetStoreVisits`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '유입 기록을 초기화하지 못했습니다.');
    }
}
