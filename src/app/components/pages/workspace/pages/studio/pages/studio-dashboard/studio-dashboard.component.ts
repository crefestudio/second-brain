import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../../../../services/auth.service';
import { CareRequestService } from '../../../../../../../services/care-request.service';
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

    requests: Array<{ id: string; status: string; statusClass: string; type: string; title: string }> = [];
    
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

    credit = 0;

    constructor(private authService: AuthService, private careRequests: CareRequestService) {
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
        if (this.userId) {
            const result = await this.careRequests.list();
            this.requests = result.requests.slice(0, 3).map(request => ({
                id: request.id,
                status: request.status,
                statusClass: request.status === '답변 완료' ? 'success' : 'pending',
                type: request.type,
                title: request.title
            }));
        }

        _log(
            'updateSession memberUid, userId, kakaoUserId, notionAccessToken =>',
            this.memberUid,
            this.userId,
            this.kakaoUserId,
            this.notionAccessToken
        );
    }
}
