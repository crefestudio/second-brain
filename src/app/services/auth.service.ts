import { _log } from '../lib/cf-common/cf-common';
import { Injectable } from '@angular/core';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    userId = '';            // 워크스페이스 id : user - template - notion - kakao
    memberUid = '';         // 홈페이지 id
    kakaoUserId = '';       // 카카오톡 연결 여부
    notionAccessToken = ''; // 노션 연결 여부

    async updateSession(): Promise<void> {
        this.memberUid = localStorage.getItem('member_uid')?.trim() ?? '';

        // localhost 테스트용
        if (window.location.hostname == 'localhost') {
            _log('로컬 호스트 - 테스트 모드 - toto791@gmail.com으로 로그인')
            this.memberUid = 'toto791@gmail.com';
        }        

        // 서버에서 다시 가져옴
        const user = await UserService.getUserByImwebMemberId(this.memberUid);
        this.userId = user?.userId ?? '';        
        this.kakaoUserId = user?.kakaoUserId ?? '';
        this.notionAccessToken = user?.notionAccessToken ?? '';

        // this.userId = "";
        // this.kakaoUserId = '';
        // this.notionAccessToken = '';  
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