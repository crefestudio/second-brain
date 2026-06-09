import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-subscription',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './subscription.component.html',
    styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent {
    requestMode = false;
    verifyValue = '';

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