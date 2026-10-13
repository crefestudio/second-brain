import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type StoreVisitSource = { location: string; count: number; siteVisits: number; title?: string | null; sourceViews: number | null };
export type StoreVisitLog = { id: string; collection: 'storeVisits' | 'siteVisits'; productPath: string; path?: string; targetName?: string; createdAt: string };
export type ProductVisitLog = { id: string; collection: 'storeVisits'; location: string; title?: string | null; createdAt: string };
export type MarketingReportResult = { report: { month: string; generatedAt: string; warnings: string[]; metrics: Array<{ name: string; actual: number | null; target: number; unit: string; lever: string; action: string; gap: number | null; status: string }> }; ai?: string; model?: string };
export type StoreVisitSummary = { month: string; totalViews: number; dailyInflows?: { today: number; yesterday: number; dayBeforeYesterday: number }; productViews: Record<string, number>; productSales: Record<string, { count: number; revenue: number }>; sources: StoreVisitSource[] };

@Injectable({ providedIn: 'root' })
export class SalesAdminService {
    async productVisitLogs(detailProduct: string): Promise<{ month: string; logs: ProductVisitLog[]; capped: boolean }> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/getStoreVisitSummary`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ detailProduct }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.logs)) throw new Error(payload.error || '상품 유입 로그를 불러오지 못했습니다.');
        return payload;
    }
    async visitLogs(detailSource: string): Promise<{ month: string; logs: StoreVisitLog[]; capped: boolean }> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/getStoreVisitSummary`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ detailSource }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.logs)) throw new Error(payload.error || '유입 로그를 불러오지 못했습니다.');
        return payload;
    }
    async deleteVisitLog(log: Pick<StoreVisitLog, 'id' | 'collection'>): Promise<void> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/deleteStoreVisitLog`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: log.id, collection: log.collection })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '유입 기록을 삭제하지 못했습니다.');
    }
    async marketingReport(goals: { revenue: number; averagePrice: number; trafficConversion: number; purchaseConversion: number }, ai: boolean): Promise<MarketingReportResult> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/getMarketingReport`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ goals, ai }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '리포트를 생성하지 못했습니다.');
        return payload as MarketingReportResult;
    }
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
}
