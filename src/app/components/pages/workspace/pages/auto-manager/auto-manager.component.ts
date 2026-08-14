import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { _log } from '../../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../../services/user.service';
import { ToastService } from '../../../../../services/toast.service';
import { AuthService } from '../../../../../services/auth.service';

@Component({
    selector: 'app-auto-manager',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './auto-manager.component.html',
    styleUrls: ['./auto-manager.component.css']
})
export class AutoManagerComponent {
    isLoading = true;

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    errorMessage = '';
    warnMessage = '';

    automationAgents = [
        {
            id: 'secondbrain',
            category: ['LifeUp', '지식관리'],
            name: '세컨드브레인 노트 키워드 추출',
            description: [
                '노트 DB에서 페이지 생성 또는 수정',
                '내용 변경 시 자동 감지',
                '변경 후 약 1분 뒤 실행'
            ],
            status: 'waiting',
            enabled: false,
            tooltip:
                '노트 DB에 페이지가 생성되거나 수정되면 AI가 자동으로 키워드를 추출하여 지정된 속성에 저장합니다.'
        },
        {
            id: 'kakao-capture',
            category: ['LifeUp', '비서'],
            name: '카카오톡 AI 비서',
            description: [
                '카카오톡 메시지 수신',
                '설정된 규칙 자동 분석',
                '할일, 메모 DB로 자동 저장'
            ],
            status: 'waiting',
            enabled: false,
            tooltip:
                '카카오톡으로 입력된 내용을 자동으로 분석하여 노션 데이터베이스에 저장합니다.'
        }
    ];

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

        const automations = await UserService.getUserIntegrations(this.userId);

        this.automationAgents =
            this.automationAgents.map(agent => ({
                ...agent,
                enabled: automations[agent.id]?.enabled ?? false
            }));
    }

    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log('updateSession memberUid, userId, notionAccessToken =>', this.memberUid, this.userId, this.kakaoUserId, this.notionAccessToken);

        if (!this.userId) {
            console.error('워크스페이스 로그인에 실패하였습니다.');
            this.errorMessage = '워크스페이스 로그인에 실패하였습니다.';
            return;
        }
    }

    async onChangeAgentEnabled(agent: any) {
        const oldValue = !agent.enabled;
        const result = await UserService.updateUserAutomation(
            this.userId,
            agent.id,
            {
                enabled: agent.enabled
            }
        );

        if (result) {
            ToastService.show(`${agent.name}이 ${agent.enabled ? '활성화' : '비활성화'}되었습니다.`);
        } else {
            agent.enabled = oldValue;
            ToastService.error('상태 변경에 실패하였습니다.');
        }
    }
}


// eventTitle
// "<span style="color:#7fb7ff">B.현재 best</span> 노트 키워드 추출 진행"
// (string)

// eventType
// "generate-note-keyword-webhook"
// (string)

// status
// "running"
// (string)

// updatedAt
// 2026년 2월 15일 오후 7시 15분 43초 UTC+9