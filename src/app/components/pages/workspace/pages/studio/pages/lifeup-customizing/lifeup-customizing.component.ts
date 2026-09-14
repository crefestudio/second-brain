import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../../../services/auth.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

@Component({
    selector: 'app-lifeup-customizing',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lifeup-customizing.component.html',
    styleUrl: './lifeup-customizing.component.scss'
})
export class LifeupCustomizingComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    constructor(private authService: AuthService) {
    }

    async ngOnInit() {
        try {
            await this.initData();
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();
    }

    async updateSession() {
        await this.authService.updateSession();

        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log(
            'updateSession memberUid, userId, kakaoUserId, notionAccessToken =>',
            this.memberUid,
            this.userId,
            this.kakaoUserId,
            this.notionAccessToken
        );
    }
}