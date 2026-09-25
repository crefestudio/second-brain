import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type LifeupCustomer = {
    id: string; name?: string; phone?: string; phoneDisplay?: string; emails?: string[];
    purchasedAt?: string; notificationConsent?: '예' | '아니오' | '미응답';
    memberType?: 'standard' | 'premium' | null; [key: string]: unknown;
};

@Injectable({ providedIn: 'root' })
export class CustomerAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;

    async list(): Promise<LifeupCustomer[]> {
        return this.request('listLifeupCustomers');
    }

    async importCsv(csv: string): Promise<{ csvCount: number; customerCount: number; skippedRows: number }> {
        return this.request('importLifeupCustomersCsv', { csv });
    }

    private async request(endpoint: string, body: Record<string, unknown> = {}): Promise<any> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '고객 정보를 처리하지 못했습니다.');
        return endpoint === 'listLifeupCustomers' ? (Array.isArray(payload.customers) ? payload.customers : []) : payload;
    }
}
