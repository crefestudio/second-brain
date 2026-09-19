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
    private pollTimer?: ReturnType<typeof setTimeout>;
    private pollingStartedAt = 0;
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

            this.pollingStartedAt = Date.now();
            void this.checkConnection(userId);
        });
    }

    ngOnDestroy(): void {
        if (this.pollTimer) clearTimeout(this.pollTimer);
    }

    private async checkConnection(userId: string): Promise<void> {
        try {
            if (await this.userService.getNotionConnectionStatus(userId)) {
                this.isPending = false;
                return;
            }
        } catch (error) {
            console.warn('[Notion OAuth] connection check failed', error);
        }
        if (Date.now() - this.pollingStartedAt < this.pollingDeadlineMs) {
            this.pollTimer = setTimeout(() => void this.checkConnection(userId), 10_000);
        }
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
