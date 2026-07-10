import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { _log } from '../../../lib/cf-common/cf-common';

const TEMPLATE_KEY_LIFEUP = 'lifeUp';

@Component({
    selector: 'app-workspace',
    imports: [RouterLink],
    templateUrl: './workspace.component.html',
    styleUrl: './workspace.component.css'
})
export class WorkspaceComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';
    hasLifeupPurchase: boolean = false;
    purchaseInfo: any = null;

    // event count
    totalCount: number = 0;
    kakaoCount: number = 0;
    secondbrainCount: number = 0;

    constructor(private userService: UserService, private authService: AuthService) {

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
        await this.updatePurchaseInfo();
        await this.updateEventCount();
    }

    async updateEventCount() {
        [
            this.totalCount,
            this.kakaoCount,
            this.secondbrainCount
        ] = await Promise.all([
            UserService.getTodayEventCount(this.userId),
            UserService.getTodayEventCount(this.userId, 'kakao-capture'),
            UserService.getTodayEventCount(this.userId, 'secondbrain')
        ]);
    }
    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log('updateSession memberUid, userId, notionAccessToken =>', this.memberUid, this.userId, this.kakaoUserId, this.notionAccessToken);

        // if (!this.userId) {
        //     console.error('워크스페이스 로그인에 실패하였습니다.');
        //     this.errorMessage = '워크스페이스 로그인에 실패하였습니다.';
        //     return;
        // }
    }

    async updatePurchaseInfo() {
        if (this.userId) {
            this.purchaseInfo = await UserService.getPurchaseInfo(this.userId, TEMPLATE_KEY_LIFEUP);
        } else {
            this.purchaseInfo = await UserService.getPurchaseInfoFromLocalstorage(TEMPLATE_KEY_LIFEUP);
        }
        _log('updatePurchaseInfo userId, purchaseInfo =>', this.userId, this.purchaseInfo);

        this.hasLifeupPurchase = this.purchaseInfo != null;
    }



}
