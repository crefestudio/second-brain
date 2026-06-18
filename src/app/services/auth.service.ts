import { Injectable } from '@angular/core';
import { UserService } from './user.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    memberUid = '';
    userId = '';

    async loadSession(): Promise<void> {

        this.memberUid =
            localStorage.getItem('member_uid')?.trim() ?? '';

        // localhost 테스트용
        if (window.location.hostname !== 'app.notionable.net') {
            this.memberUid = 'toto791@gmail.com';
        }

        this.userId = await UserService.getUserIdByImwebMemberId( this.memberUid) ?? '';
    }

    getMemberUid(): string {
        return this.memberUid;
    }

    getUserId(): string {
        return this.userId;
    }
}