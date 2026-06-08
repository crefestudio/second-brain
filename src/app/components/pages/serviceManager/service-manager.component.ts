import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-service-manager',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './service-manager.component.html',
    styleUrls: ['./service-manager.component.css']
})
export class ServiceManagerComponent {

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

        alert('이메일 또는 휴대폰 번호를 입력해주세요.');
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