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

    errorMessage = '';
    warnMessage = '';


    constructor(private router: Router, private toastService: ToastService) {
        this.currentPath = this.router.url;

        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.currentPath = this.router.url;
            });
    }

    ngOnInit(): void {
        this.toastService.toast$.subscribe(message => {

            this.toastMessage = message;
            this.isShowToast = true;

            setTimeout(() => {
                this.isShowToast = false;
            }, 3000);
        });

        // 사용법 테스트
        //ToastService.show('저장되었습니다.');
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

