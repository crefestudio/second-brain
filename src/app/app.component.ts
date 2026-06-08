import { Component, OnInit } from '@angular/core';
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
export class AppComponent {
     
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

    // toggleLifeup() {
    //     this.lifeupOpen = !this.lifeupOpen;
    // }
}