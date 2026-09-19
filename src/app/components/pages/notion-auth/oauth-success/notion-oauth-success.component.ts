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
    connectionState: 'checking' | 'waiting' | 'delayed' = 'checking';
    checkCount = 0;
    nextCheckAt?: number;
    now = Date.now();
    private pollTimer?: ReturnType<typeof setTimeout>;
    private statusTimer?: ReturnType<typeof setInterval>;
    private pollingStartedAt = 0;
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

            if (this.pollTimer) clearTimeout(this.pollTimer);
            this.pollingStartedAt = Date.now();
            this.now = this.pollingStartedAt;
            this.connectionState = 'checking';
            this.checkCount = 0;
            this.nextCheckAt = undefined;
            this.statusTimer ??= setInterval(() => this.now = Date.now(), 1000);
            void this.checkConnection(userId);
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
            if (await this.userService.getNotionConnectionStatus(userId)) {
                this.isPending = false;
                if (this.statusTimer) clearInterval(this.statusTimer);
                return;
            }
        } catch (error) {
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
        if (!this.pollingStartedAt) return 0;
        return Math.min(100, Math.round(((this.now - this.pollingStartedAt) / this.pollingDeadlineMs) * 100));
    }

    get secondsUntilRetry(): number {
        if (!this.nextCheckAt) return 0;
        return Math.max(0, Math.ceil((this.nextCheckAt - this.now) / 1000));
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
