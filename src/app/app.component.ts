import { Component, OnInit } from '@angular/core';
import { ToastService } from './services/toast.service';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
    Router,
    NavigationEnd,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
} from '@angular/router';

import { filter } from 'rxjs/operators';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { auth } from './firebase';
import { APP_CONFIG } from './config/app-config.token';
import { inject } from '@angular/core';

@Component({
    selector: 'app-root',
    imports: [
        CommonModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
    private readonly functionsBaseUrl = inject(APP_CONFIG).functionsBaseUrl;

    currentPath = '/service';

    serviceOpen = true;
    lifeupOpen = true;
    mypageOpen = true;
    title = 'second-brain-app';

    // toast
    isShowToast = false;
    toastMessage!: SafeHtml;
    toastType: 'success' | 'warning' | 'error'  = 'success';

    errorMessage = '';
    warnMessage = '';
    showUpdatePrompt = false;
    private availableVersionHash = '';
    private dismissedVersionHash = '';


    constructor(
        private router: Router,
        private toastService: ToastService,
        private swUpdate: SwUpdate
    ) {
        this.currentPath = this.router.url;

        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.currentPath = this.router.url;
                this.notifyEmbedRouteChange();
                void this.recordSiteVisit();
            });
    }

    ngOnInit(): void {
        void this.recordSiteVisit();
        this.watchForAppUpdate();
        this.toastService.toast$.subscribe((toast) => {
            this.toastMessage = toast.message;
            this.toastType = toast.type;

            this.isShowToast = true;

            setTimeout(() => {
                this.isShowToast = false;
            }, 3000);
        });

        // 사용법 테스트
        //ToastService.show('저장되었습니다.');
    }

    private async recordSiteVisit(): Promise<void> {
        if (this.currentPath.startsWith('/store/') || !document.referrer) return;
        const source = (() => { try { const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, ''); return host.endsWith('notionable.net') ? '' : host; } catch { return ''; } })();
        if (!source) return;
        try {
            await auth.authStateReady();
            const token = await auth.currentUser?.getIdToken();
            const key = 'site-tracking-browser';
            let sessionId = localStorage.getItem(key);
            if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem(key, sessionId); }
            await fetch(`${this.functionsBaseUrl}/recordSiteVisit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, keepalive: true, body: JSON.stringify({ referrer: document.referrer, path: this.currentPath, sessionId }) });
        } catch { /* Analytics must never interrupt navigation. */ }
    }

    private watchForAppUpdate(): void {
        if (!this.swUpdate.isEnabled) return;

        this.swUpdate.versionUpdates
            .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
            .subscribe((event) => {
                const versionHash = event.latestVersion.hash;
                if (versionHash === this.dismissedVersionHash) return;
                this.availableVersionHash = versionHash;
                this.showUpdatePrompt = true;
            });

        void this.swUpdate.checkForUpdate();
        window.setInterval(() => void this.swUpdate.checkForUpdate(), 5 * 60 * 1000);
    }

    async reloadWithLatestApp(): Promise<void> {
        await this.swUpdate.activateUpdate();
        window.location.reload();
    }

    dismissAppUpdate(): void {
        this.dismissedVersionHash = this.availableVersionHash;
        this.showUpdatePrompt = false;
    }

    private notifyEmbedRouteChange(): void {
        if (window.parent === window) return;
        window.parent.postMessage({
            type: 'APP_ROUTE_CHANGED',
            path: this.currentPath
        }, 'https://notionable.net');
    }


    copyLink() {
        const url =
            `https://app.notionable.net${this.currentPath}`;

        navigator.clipboard.writeText(url);
    }

    // toggleLifeup() {
    //     this.lifeupOpen = !this.lifeupOpen;
    // }
}

