import { Injectable } from '@angular/core';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    userId = '';
    memberUid = '';
    kakaoUserId = '';

    async updateSession(): Promise<void> {
        this.memberUid = localStorage.getItem('member_uid')?.trim() ?? '';

        // localhost 테스트용
        if (window.location.hostname !== 'app.notionable.net') {
            this.memberUid = 'toto791@gmail.com';
        }

        // 서버에서 다시 가져옴
        const user = await UserService.getUserByImwebMemberId(this.memberUid);
        this.userId = user?.userId ?? '';
        this.kakaoUserId = user?.kakaoUserId ?? '';
    }

    getUserIds() {
        return {
            userId: this.userId,
            memberUid: this.memberUid,
            kakaoUserId: this.kakaoUserId
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
}