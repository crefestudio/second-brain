import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type LifeupCustomer = {
    id: string; name?: string; phone?: string; phoneDisplay?: string; emails?: string[];
    purchasedAt?: string; notificationConsent?: '예' | '아니오' | '미응답' | '차단'; membership?: 'premium' | 'standard' | 'none';
    memberType?: 'standard' | 'premium' | null; [key: string]: unknown;
};
export type LifeupCustomerQuery = { search: string; memberFilter: string; membershipFilter: string; notifyFilter: string; sort: string; direction: string };
export type LifeupCustomerPage = { customers: LifeupCustomer[]; nextCursor: string | null; totalCount: number; filteredCount: number };

@Injectable({ providedIn: 'root' })
export class CustomerAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;

    async list(query: LifeupCustomerQuery, after?: string, signal?: AbortSignal): Promise<LifeupCustomerPage> {
        return this.request('listLifeupCustomers', { ...query, after }, signal);
    }

    async importCsv(csv: string): Promise<{ csvCount: number; customerCount: number; skippedRows: number }> {
        return this.request('importLifeupCustomersCsv', { csv });
    }

    async sendSelectedMail(customerIds: string[], template: 'standard-purchaser-welcome' | 'standard-purchaser-update' | 'premium-purchaser-welcome', confirmNonConsenting = false, requestId: string = crypto.randomUUID()): Promise<{ requiresConsentConfirmation?: boolean; recipientCount?: number; nonConsentingCount?: number; blockedCount?: number; queuedCount?: number; failedCount?: number }> {
        return this.request('sendLifeupCustomerMail', { customerIds, template, confirmNonConsenting, requestId });
    }

    private async request(endpoint: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<any> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '고객 정보를 처리하지 못했습니다.');
        if (endpoint === 'listLifeupCustomers') return {
            customers: Array.isArray(payload.customers) ? payload.customers : [],
            nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
            totalCount: Number.isFinite(payload.totalCount) ? Number(payload.totalCount) : 0,
            filteredCount: Number.isFinite(payload.filteredCount) ? Number(payload.filteredCount) : 0
        };
        return payload;
    }
}
