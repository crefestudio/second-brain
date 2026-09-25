import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config.token';
import { auth } from '../firebase';

export type AppMember = { id: string; profileName: string; email: string; phoneNumber: string; workspaceIds: string[]; createdAt: string; marketingConsent: boolean; };

@Injectable({ providedIn: 'root' })
export class MemberAdminService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async list(): Promise<AppMember[]> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('로그인이 필요합니다.');
        const response = await fetch(`${this.baseUrl}/listAppMembers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '회원 목록을 불러오지 못했습니다.');
        return Array.isArray(payload.members)
            ? payload.members.map((member: Partial<AppMember>) => ({ ...member, workspaceIds: Array.isArray(member.workspaceIds) ? member.workspaceIds : [] } as AppMember))
            : [];
    }
}
