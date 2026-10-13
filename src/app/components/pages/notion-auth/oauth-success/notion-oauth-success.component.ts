import { _log } from '../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../services/user.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-oauth-success',
    standalone: true,
    imports: [
        CommonModule
    ],
    templateUrl: './notion-oauth-success.component.html',
    styleUrls: ['./notion-oauth-success.component.css'],
})
export class NotionOauthSuccessComponent implements OnInit, OnDestroy {
    isPending = true;
    databaseChecks: Array<{ name: string; status: string; message?: string }> = [];
    connectionError = '';
    connectionState: 'checking' | 'waiting' | 'delayed' | 'failed' = 'checking';
    checkCount = 0;
    nextCheckAt?: number;
    now = Date.now();
    private pollTimer?: ReturnType<typeof setTimeout>;
    private statusTimer?: ReturnType<typeof setInterval>;
    private pollingStartedAt = 0;
    private userId = '';
    readonly pollingIntervalMs = 10 * 1000;
    private readonly pollingDeadlineMs = 5 * 60 * 1000;
    // state = 'ready';
    // workspaceName: string | null = null;
    // botId: string | null = null;

    constructor(private route: ActivatedRoute, private userService: UserService) {

    }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            const userId = params.get('userId');
            _log('OAuth callback userId =>', userId);

            if (!userId) return;
            this.userId = userId;

            this.retryConnection();
        });
    }

    ngOnDestroy(): void {
        if (this.pollTimer) clearTimeout(this.pollTimer);
        if (this.statusTimer) clearInterval(this.statusTimer);
    }

    private async checkConnection(userId: string): Promise<void> {
        this.connectionState = 'checking';
        this.nextCheckAt = undefined;
        this.checkCount++;
        try {
            const result = await this.userService.getNotionConnectionDetails(userId);
            this.databaseChecks = result.databaseChecks || [];
            this.connectionError = result.error || (result.status === 'disconnected' ? '노션 인증 정보가 없습니다. 연결을 다시 시작해주세요.' : '');
            if (result.connected) {
                this.isPending = false;
                if (this.statusTimer) clearInterval(this.statusTimer);
                return;
            }
        } catch (error: any) {
            this.databaseChecks = error?.error?.databaseChecks || this.databaseChecks;
            this.connectionError = error?.error?.error || '서버 응답을 받지 못했습니다. 잠시 후 다시 확인합니다.';
            if (error?.error?.retryable === false) {
                this.connectionState = 'failed';
                if (this.pollTimer) clearTimeout(this.pollTimer);
                if (this.statusTimer) clearInterval(this.statusTimer);
                this.statusTimer = undefined;
                return;
            }
            console.warn('[Notion OAuth] connection check failed', error);
        }
        if (Date.now() - this.pollingStartedAt < this.pollingDeadlineMs) {
            this.connectionState = 'waiting';
            this.nextCheckAt = Date.now() + this.pollingIntervalMs;
            this.pollTimer = setTimeout(() => void this.checkConnection(userId), this.pollingIntervalMs);
        } else {
            this.connectionState = 'delayed';
            this.nextCheckAt = undefined;
        }
    }

    get progressPercent(): number {
        if (!this.databaseChecks.length) return 0;
        return Math.round(this.databaseChecks.filter(item => item.status === 'found').length / this.databaseChecks.length * 100);
    }

    get secondsUntilRetry(): number {
        if (!this.nextCheckAt) return 0;
        return Math.max(0, Math.ceil((this.nextCheckAt - this.now) / 1000));
    }

    retryConnection(): void {
        if (!this.userId) return;
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollingStartedAt = Date.now();
        this.now = this.pollingStartedAt;
        this.connectionState = 'checking';
        this.checkCount = 0;
        this.nextCheckAt = undefined;
        this.statusTimer ??= setInterval(() => this.now = Date.now(), 1000);
        void this.checkConnection(this.userId);
    }

    // async loadSecondBrainIntegrationInfo(userId: string) {
    //     const data = await UserService.getUserIntegrationInfo(userId, ''); //
    //     _log('loadSecondBrainIntegrationInfo data =>', data);

    //     if (!data) {
    //         this.state = 'fail';
    //         return;
    //     }

    //     this.state = 'success';
    //     this.botId = data.botId ?? null;    // 보안상 botId를 connectKey로 저장한다. 
    //     this.workspaceName = data.workspaceName ?? null;
    // }   

    // closeWindow() {
    //     window.close();
    // }

}
