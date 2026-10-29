import { canUseAgent } from '../../../config/template-catalog';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { _log } from '../../../lib/cf-common/cf-common';
import { UpgradeBannerComponent } from '../../common/upgrade-banner.component';

const TEMPLATE_KEY_LIFEUP = 'lifeUp';

@Component({
    selector: 'app-workspace',
    imports: [CommonModule, RouterLink, UpgradeBannerComponent],
    templateUrl: './workspace.component.html',
    styleUrl: './workspace.component.css'
})
export class WorkspaceComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';
    isLifeupPurchaser: boolean = false;
    purchaseInfo: any = null;

    templateUrl: string | null = null;


    // event count
    totalCount: number = 0;
    monthTotalCount = 0;
    routineCount = 0;
    kakaoCount: number = 0;
    secondbrainCount: number = 0;

    automationAgents = [
        {
            id: 'secondbrain',
            name: '세컨드브레인 노트 키워드 추출',
            status: 'waiting',
        },
        {
            id: 'kakao-capture',
            name: '카카오톡 AI 비서',
            status: 'waiting',
        },
        {
            id: 'routine',
            name: '루틴',
            status: 'waiting',
        }
    ];


    constructor(private userService: UserService, public authService: AuthService) {

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
        await this.loadLifeupTemplateInfo();
        await this.updateEventCount();

        // 자동화 정보
        const automations = await UserService.getUserIntegrations(this.userId);
        this.automationAgents = await Promise.all(
            this.automationAgents.filter(agent => canUseAgent(this.authService.templateId, agent.id)).map(async agent => {
                // Routine automation defaults to enabled on the server for existing users.
                const enabled = agent.id === 'routine'
                    ? automations[agent.id]?.enabled !== false
                    : !!automations[agent.id]?.enabled;
                const status = agent.id === 'routine'
                    ? await UserService.getRoutineAutomationStatus(this.userId, enabled)
                    : enabled ? 'running' : 'waiting';
                return { ...agent, enabled, status };
            })
        );

    }

    async loadLifeupTemplateInfo(): Promise<void> {
        if (!this.userId || !this.notionAccessToken) {
            this.templateUrl = null;
            return;
        }
        try {
            const info: any = await this.userService.getLifeupTemplateInfo(this.userId);
            this.templateUrl = info?.pageUrls?.root ?? null;
        } catch (error) {
            console.error('LifeUp template info load failed', error);
            this.templateUrl = null;
        }
    }

    async openLifeup(): Promise<void> {
        if (!this.userId || !this.notionAccessToken) return;
        try {
            const info: any = await this.userService.getLifeupTemplateInfo(this.userId);
            const url = info?.pageUrls?.root;

            if (!url) {
                console.warn('LifeUp root page URL not found');
                return;
            }

            window.open(url, '_blank');
        } catch (error) {
            console.error('LifeUp open failed', error);
        }
    }

    async updateEventCount() {
        [
            this.totalCount,
            this.kakaoCount,
            this.secondbrainCount,
            this.routineCount,
            this.monthTotalCount
        ] = await Promise.all([
            UserService.getTodayEventCount(this.userId),
            UserService.getTodayEventCount(this.userId, 'kakao-capture'),
            UserService.getTodayEventCount(this.userId, 'secondbrain'),
            UserService.getTodayEventCount(this.userId, 'routine'),
            UserService.getTodayEventCount(this.userId, undefined, 'month')
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
        const result = await UserService.updatePurchaseInfo(this.userId, this.authService.templateId);
        this.purchaseInfo = result.purchaseInfo;
        this.isLifeupPurchaser = result.isPurchaser;
    }


}
