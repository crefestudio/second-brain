import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type MarketingBlock = { id: string; email: string; phone: string; source: 'public' | 'legacyCustomer'; blockedAt: number };
export type MarketingBlockPage = { blocks: MarketingBlock[]; totalCount: number; hasMore: boolean };

@Injectable({ providedIn: 'root' })
export class MarketingBlockAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async list(before?: MarketingBlock): Promise<MarketingBlockPage> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/listMarketingBlocks`, { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(before ? { before: before.blockedAt, beforeId: before.id } : {}) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '수신 차단 목록을 불러오지 못했습니다.');
        return { blocks: Array.isArray(payload.blocks) ? payload.blocks : [], totalCount: Number(payload.totalCount) || 0, hasMore: payload.hasMore === true };
    }
}
