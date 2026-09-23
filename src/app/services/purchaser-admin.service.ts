import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type LifeupPurchaser = {
    id: string; purchasedAt?: string; name?: string; email?: string; phone?: string;
    purchaseOption?: string; amount?: string | number; paymentMethod?: string; status?: string;
    memberType?: 'standard' | 'premium' | null; purchaseEligible?: boolean; upgradeOnly?: boolean;
    [key: string]: unknown;
};

@Injectable({ providedIn: 'root' })
export class PurchaserAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async listLifeupPurchasers(): Promise<LifeupPurchaser[]> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/listLifeupPurchasers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '구매자 목록을 불러오지 못했습니다.');
        return Array.isArray(payload.purchasers) ? payload.purchasers : [];
    }
    async validateCsv(csv: string): Promise<{ results: CsvValidation[]; csvCount: number }> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/validateLifeupPurchaserCsv`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ csv }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'CSV 대조에 실패했습니다.');
        return payload;
    }
}

export type CsvValidation = { id?: string; registrationStatus: 'webhook' | 'file_added' | 'file_verified' | 'file_mismatch'; csv?: Partial<LifeupPurchaser>; issues: string[] };
