import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type InvitationTier = 'standard' | 'premium';
export type Invitation = { email: string; memberType: InvitationTier; expiresAt: number; redeemed: boolean };
export type CreatedInvitation = Omit<Invitation, 'redeemed'> & { url: string };

@Injectable({ providedIn: 'root' })
export class PurchaseInvitationService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    private async request<T>(endpoint: string, body: object, admin = false): Promise<T> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (admin) {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('관리자 계정으로 로그인해주세요.');
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${this.baseUrl}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
        return data as T;
    }
    create(email: string, memberType: InvitationTier): Promise<CreatedInvitation> { return this.request('createLifeupInvitation', { email, memberType }, true); }
    inspect(token: string): Promise<Invitation> { return this.request('getLifeupInvitation', { token }); }
    redeem(token: string, name: string, phone: string): Promise<{ success: boolean }> { return this.request('redeemLifeupInvitation', { token, name, phone }); }
}
