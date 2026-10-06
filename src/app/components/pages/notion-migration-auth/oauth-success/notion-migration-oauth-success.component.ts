import { _log } from '../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../services/user.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
    connectionState: 'checking' | 'waiting' | 'delayed' | 'error' = 'checking';
    connectionError = '';
    checkCount = 0;
    nextCheckAt?: number;
    now = Date.now();
    private pollTimer?: ReturnType<typeof setTimeout>;
    private statusTimer?: ReturnType<typeof setInterval>;
    readonly pollingIntervalMs = 10 * 1000;
    private readonly pollingDeadlineMs = 5 * 60 * 1000;
    private pollingStartedAt = 0;
    private userId = '';

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
            const connected = await this.userService.getMigrationConnectionStatus(userId);
            if (connected) {
                this.isPending = false;
                if (this.statusTimer) clearInterval(this.statusTimer);
                return;
            }
        } catch (error) {
            console.warn('[Migration OAuth] connection check failed', error);
            if (error instanceof HttpErrorResponse && error.error?.code === 'MIGRATION_TEMPLATE_DUPLICATE') {
                this.connectionState = 'error';
                this.connectionError = error.error.error;
                this.nextCheckAt = undefined;
                if (this.pollTimer) clearTimeout(this.pollTimer);
                if (this.statusTimer) clearInterval(this.statusTimer);
                return;
            }
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

    retryConnection(): void {
        if (!this.userId) return;
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollingStartedAt = Date.now();
        this.now = this.pollingStartedAt;
        this.connectionState = 'checking';
        this.connectionError = '';
        this.checkCount = 0;
        this.nextCheckAt = undefined;
        this.statusTimer ??= setInterval(() => this.now = Date.now(), 1000);
        void this.checkConnection(this.userId);
    }

}
