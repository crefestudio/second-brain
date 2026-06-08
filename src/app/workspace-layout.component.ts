import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationEnd,
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { filter } from 'rxjs/operators';

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
export class WorkspaceLayoutComponent {
    currentPath = '/service';

    serviceOpen = true;
    lifeupOpen = true;
    mypageOpen = true;
    title = 'second-brain-app';

    constructor(private router: Router) {
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
        return !!localStorage.getItem('auth_token');
    }


    // toggleLifeup() {
    //     this.lifeupOpen = !this.lifeupOpen;
    // }
}