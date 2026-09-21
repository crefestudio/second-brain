import { Component, OnInit } from '@angular/core';
import { CareRequestService } from './services/care-request.service';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationEnd,
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { filter } from 'rxjs/operators';
import { SocialAuthService } from './services/social-auth.service';

@Component({
    selector: 'app-workspace-layout',
     imports: [
        CommonModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive
    ],
    templateUrl: './workspace-layout.component.html',
    styleUrl: './workspace-layout.component.scss'
})
export class WorkspaceLayoutComponent implements OnInit {
    isCareAdmin = false;
    adminOpen = true;
    async ngOnInit() {
        await this.auth.init();
        try { this.isCareAdmin = (await this.care.access()).isAdmin; }
        catch { this.isCareAdmin = false; }
    }
    currentPath = '/service';

    serviceOpen = true;
    lifeupOpen = true;
    mypageOpen = true;
    title = 'second-brain-app';

    constructor(private router: Router, public auth: SocialAuthService, private care: CareRequestService) {
        this.currentPath = this.router.url;

        this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
            this.currentPath = this.router.url;
        });
    }

    copyLink() {
        const url =
        `https://app.notionable.net${this.currentPath}`;

        navigator.clipboard.writeText(url);
    }

    get isLoggedIn(): boolean {
        return !!this.auth.account();
    }


    // toggleLifeup() {
    //     this.lifeupOpen = !this.lifeupOpen;
    // }
}
