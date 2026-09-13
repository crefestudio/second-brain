import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../../../../services/auth.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

@Component({
    selector: 'app-studio-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './studio-dashboard.component.html',
    styleUrl: './studio-dashboard.component.scss'
})
export class StudioDashboardComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    // 임시 데이터
    requests = [
        {
            status: '진행중',
            statusClass: 'pending',
            type: '문의',
            title: '라이프업에서 이 기능을 어떻게 사용하나요?'
        },
        {
            status: '완료',
            statusClass: 'success',
            type: '요청',
            title: '라이프업 구조 변경 요청'
        }
    ];
    
    activities = [
        {
            type: '질문 게시판',
            title: '노션 데이터베이스 관련 질문입니다.'
        }
    ];

    news = [
        {
            type: '업데이트 알림',
            date: '2027.03',
            title: '라이프업 새로운 업데이트 안내'
        }
    ];

    credit = 10;

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