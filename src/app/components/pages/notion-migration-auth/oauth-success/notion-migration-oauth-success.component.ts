import { _log } from '../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../services/user.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-migration-oauth-success',
    standalone: true,
    imports: [
        CommonModule
    ],
    templateUrl: './notion-migration-oauth-success.component.html',
    styleUrls: ['./notion-migration-oauth-success.component.css'],
})
export class NotionMigrationOauthSuccessComponent implements OnInit, OnDestroy {
    isPending = true;
    private pollTimer?: ReturnType<typeof setTimeout>;
    private readonly pollingDeadlineMs = 5 * 60 * 1000;
    private pollingStartedAt = 0;

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
            const connected = await this.userService.getMigrationConnectionStatus(userId);
            if (connected) {
                this.isPending = false;
                return;
            }
        } catch (error) {
            console.warn('[Migration OAuth] connection check failed', error);
        }

        if (Date.now() - this.pollingStartedAt < this.pollingDeadlineMs) {
            this.pollTimer = setTimeout(() => void this.checkConnection(userId), 10_000);
        }
    }

}
