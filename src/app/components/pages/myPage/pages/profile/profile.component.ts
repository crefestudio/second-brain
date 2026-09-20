import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SocialAuthService } from '../../../../../services/social-auth.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

    memberUid = '';
    name = '';
    email = '';
    phoneNumber = '';
    createdAt = '';
    provider = '';
    constructor(private socialAuth: SocialAuthService) { }

    async ngOnInit(): Promise<void> {

        await this.socialAuth.init();
        const account = this.socialAuth.account();
        this.memberUid = account?.uid ?? '';
        this.name = account?.displayName ?? '';
        this.email = account?.email ?? '';
        this.phoneNumber = account?.phoneNumber ?? '';
        this.createdAt = this.formatDate(account?.metadata.creationTime);
        this.provider = account?.providerData.map(item => item.providerId).join(', ') ?? '';
    }

    private formatDate(value?: string): string {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR');
    }
}
