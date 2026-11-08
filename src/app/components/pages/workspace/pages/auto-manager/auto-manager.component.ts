import { RecurringSchedulesService } from '../../../../../services/recurring-schedules.service';
import { canUseAgent } from '../../../../../config/template-catalog';
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
    updatingAgentIds = new Set<string>();

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    errorMessage = '';
    warnMessage = '';

    automationAgents = [
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
        },
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
            id: 'routine',
            category: ['LifeUp', '루틴'],
            name: '루틴 관리 비서',
            description: [
                '매 정시에 루틴 기록을 노션에 생성',
                '매 정시에 노션에서 루틴 기록 수신 및 기록',
                '새로운 루틴을 노션에 추가'
            ],
            status: 'running',
            enabled: true,
            tooltip: '루틴 기록 생성과 노션 동기화를 자동으로 관리합니다.'
        },
        {
            id: 'recurringSchedules', category: ['LifeUp', '일정'], name: '반복 일정 동기화',
            description: ['매일 한국시간 00:05에 오늘 일정 동기화', '수동 동기화로 노션 일정 확인 및 반영', '사용 중지 시 자동·수동 동기화 중지'],
            status: 'waiting', enabled: false,
            tooltip: '월간·연간 반복 일정을 노션 할일에 동기화하고 실행 결과를 기록합니다.'
        }
    ];

    constructor(private userService: UserService, private authService: AuthService, private recurringSchedules: RecurringSchedulesService) {

    }

    async ngOnInit() {
        this.isLoading = true;
        try {
            await this.initData();
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();

        const automations = await UserService.getUserIntegrations(this.userId);
        this.automationAgents = await Promise.all(this.automationAgents.map(async agent => {
            const enabled = canUseAgent(this.authService.templateId, agent.id) &&
                (automations[agent.id]?.enabled ?? agent.enabled);
            const status = (agent.id === 'routine' || agent.id === 'recurringSchedules')
                ? await UserService.getAutomationStatus(this.userId, agent.id, enabled)
                : enabled ? 'running' : 'waiting';
            return { ...agent, enabled, status };
        }));
    }

    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        await this.updatePurchaseInfo();

        _log('updateSession memberUid, userId, notionAccessToken =>', this.memberUid, this.userId, this.kakaoUserId, this.notionAccessToken);

        if (!this.userId) {
            console.error('워크스페이스 로그인에 실패하였습니다.');
            this.errorMessage = '워크스페이스 로그인에 실패하였습니다.';
            return;
        }
    }

    isLifeupPurchaser: boolean = false;
    purchaseInfo: any = null;
    async updatePurchaseInfo() {
        const result = await UserService.updatePurchaseInfo(this.userId, this.authService.templateId);
        this.purchaseInfo = result.purchaseInfo;
        this.isLifeupPurchaser = result.isPurchaser;
    }


    async onChangeAgentEnabled(agent: any) {
        if (this.isAgentDisabled(agent)) return;
        const oldValue = !agent.enabled;
        this.updatingAgentIds.add(agent.id);
        try {
        const result = agent.id === 'recurringSchedules'
            ? !!(await this.recurringSchedules.request(this.userId, 'enable', { enabled: agent.enabled }))
            : await UserService.updateUserAutomation(
            this.userId,
            agent.id,
            {
                enabled: agent.enabled
            }
        );

        if (result) {
            agent.status = (agent.id === 'routine' || agent.id === 'recurringSchedules')
                ? await UserService.getAutomationStatus(this.userId, agent.id, agent.enabled)
                : agent.enabled ? 'running' : 'waiting';
            ToastService.show(`${agent.name}이 ${agent.enabled ? '활성화' : '비활성화'}되었습니다.`);
        } else {
            agent.enabled = oldValue;
            ToastService.error('상태 변경에 실패하였습니다.');
        }
        } catch (error) {
            agent.enabled = oldValue;
            ToastService.error(error instanceof Error ? error.message : '상태 변경에 실패하였습니다.');
        } finally {
            this.updatingAgentIds.delete(agent.id);
        }
    }

    isAgentDisabled(agent: any): boolean {
        return this.updatingAgentIds.has(agent.id) || !canUseAgent(this.authService.templateId, agent.id) || (agent.id === 'recurringSchedules' && !this.notionAccessToken) || (agent.id === 'kakao-capture' && !this.kakaoUserId);
    }
    isAgentSupported(agent: any): boolean {
        return canUseAgent(this.authService.templateId, agent.id);
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
