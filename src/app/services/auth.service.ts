import { Injectable } from '@angular/core';
import { SocialAuthService } from './social-auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    constructor(private socialAuth: SocialAuthService) {}

    userId = '';            // 워크스페이스 id : user - template - notion - kakao
    memberUid = '';         // Firebase Authentication UID
    kakaoUserId = '';       // 카카오톡 연결 여부
    notionAccessToken = ''; // 노션 연결 여부

    async updateSession(): Promise<void> {
        const user = await this.socialAuth.session();
        this.memberUid = this.socialAuth.account()?.uid ?? '';
        this.userId = user?.userId ?? '';        
        this.kakaoUserId = user?.kakaoUserId ?? '';
        this.notionAccessToken = user?.notionConnected ? 'connected' : '';
          
    }

    getUserIds() {
        return {
            userId: this.userId,
            memberUid: this.memberUid,
            kakaoUserId: this.kakaoUserId,
            notionAccessToken: this.notionAccessToken
        };
    }

    getMemberUid(): string {
        return this.memberUid;
    }

    getUserId(): string {
        return this.userId;
    }

    getKakaoUserId(): string {
        return this.kakaoUserId;
    }

    getNotionAccessToken(): string {
        return this.notionAccessToken;
    }
}
