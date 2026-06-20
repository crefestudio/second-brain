import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../services/auth.service';
import { UserService } from '../../../../../services/user.service';

@Component({
    selector: 'app-subscription',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './subscription.component.html',
    styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent implements OnInit {
    requestMode = false;
    verifyValue = '';

    memberUid: string = '';
    userId: string = '';

    showPurchaseDetail = false;
    showDownload = false;

    hasLifeupPurchase: boolean = false;
    purchaseInfo: any = null;

    constructor(
        public router: Router,
        private authService: AuthService,
        private userService: UserService
    ) { }

    services = [
        {
            serviceName: 'Notion AI 업무 시스템',
            purchaseVerified: true,
            apiConnected: true,
            templateInfo: '영업 CRM + 고객관리'
        },
        {
            serviceName: '콘텐츠 자동화 시스템',
            purchaseVerified: true,
            apiConnected: false,
            templateInfo: '블로그 자동 발행'
        }
    ];


    ngOnInit() {
        this.updateSession();
        this.updatePurchaseInfo();

    }

    updatePurchaseInfo() {
        this.hasLifeupPurchase = UserService.isPurchased('lifeUp');

        if (this.hasLifeupPurchase) {
            this.purchaseInfo = UserService.getPurchaseInfo('lifeUp');
        } else {
            this.purchaseInfo = null;
        }
    }


    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();

        if (!this.userId) {
            console.error('사용자를 찾을 수 없습니다.');
            // this.errorMessage = '사용자를 찾을 수 없습니다.';
            return;
        }
    }

    submitVerification() {

        if (!this.verifyValue.trim()) {

            alert('구매 시 등록한 이메일 입력해주세요.');
            return;

        }

        alert('확인 신청이 접수되었습니다.');

        this.requestMode = false;
    }

    cancelVerification() {

        this.verifyValue = '';

        this.requestMode = false;
    }

}