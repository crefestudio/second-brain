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
            });
    }

    ngOnInit(): void {
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

    private watchForAppUpdate(): void {
        if (!this.swUpdate.isEnabled) return;

        // An iframe can stay open indefinitely. Activate the new cached app shell and reload
        // this frame as soon as a deployment is available, so the parent does not need to reload.
        this.swUpdate.versionUpdates
            .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
            .subscribe(async () => {
                await this.swUpdate.activateUpdate();
                window.location.reload();
            });

        void this.swUpdate.checkForUpdate();
        window.setInterval(() => void this.swUpdate.checkForUpdate(), 5 * 60 * 1000);
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

