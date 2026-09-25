import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type ProfileSettings = { displayName: string; email: string; phoneNumber: string; createdAt: string; providers: string[]; marketingConsent: boolean; marketingConsentRequired?: boolean; };

@Injectable({ providedIn: 'root' })
export class ProfileSettingsService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async get(): Promise<ProfileSettings> { return this.request('getMyProfileSettings'); }
    async save(displayName: string, marketingConsent: boolean): Promise<Pick<ProfileSettings, 'displayName' | 'marketingConsent'>> { return this.request('updateMyProfileSettings', { displayName, marketingConsent }); }
    private async request(endpoint: string, body: Record<string, unknown> = {}): Promise<any> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '프로필 정보를 처리하지 못했습니다.');
        return payload;
    }
}
