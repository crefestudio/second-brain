import { Injectable, inject } from '@angular/core';
import { auth } from '../firebase';
import { APP_CONFIG } from '../config/app-config.token';
export { COMMUNITY_ROOMS } from '../../../functions/src/community-model';
export type { CommunityRoom, CommunityPost, CommunityComment, CommunityMember } from '../../../functions/src/community-model';

@Injectable({ providedIn: 'root' })
export class CommunityService {
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    async request<T = any>(action: string, data: Record<string, unknown> = {}): Promise<T> {
        await auth.authStateReady();
        const user = auth.currentUser;
        if (!user) throw new Error('로그인이 필요합니다.');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000);
        try {
            const response = await fetch(`${this.baseUrl}/communityApi`, {
                method: 'POST', signal: controller.signal,
                headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, action })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
            if (auth.currentUser?.uid !== user.uid) throw new Error('로그인 계정이 변경되었습니다. 새로고침해주세요.');
            return result;
        } catch (error) {
            if (error instanceof TypeError || (error as Error)?.name === 'AbortError') throw new Error('서버 응답을 확인하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해주세요.');
            throw error;
        } finally { clearTimeout(timeout); }
    }
}
