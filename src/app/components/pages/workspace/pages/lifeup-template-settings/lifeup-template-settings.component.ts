import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { UserService } from '../../../../../services/user.service';
import { AuthService } from '../../../../../services/auth.service';
import { ToastService } from '../../../../../services/toast.service';

@Component({
    selector: 'app-lifeup-template-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './lifeup-template-settings.component.html',
    styleUrls: ['./lifeup-template-settings.component.css']
})
export class LifeupTemplateSettingsComponent {
    isLoading = true;

    memberUid = '';
    userId = '';

    hasLifeupPurchase = false;
    purchaseInfo: any = null;

    isLifeupTemplate = false;
    templateName = '';
    templateVersion = '';


    rootPageId = '';
    rootPageUrl = '';


    serialNumber = '';

    selectedCover = '';

    coverImages = [
        {
            id: 'cover-01',
            url: '/assets/images/lifeup/covers/cover-01.jpg'
        },
        {
            id: 'cover-02',
            url: '/assets/images/lifeup/covers/cover-02.jpg'
        },
        {
            id: 'cover-03',
            url: '/assets/images/lifeup/covers/cover-03.jpg'
        },
        {
            id: 'cover-04',
            url: '/assets/images/lifeup/covers/cover-04.jpg'
        }
    ];

    constructor(private authService: AuthService,
        private toastService: ToastService,
        private userService: UserService
    ) {
    }

    async ngOnInit(): Promise<void> {
        await this.updateSession();

        if (!this.userId) {
            this.isLoading = false;
            return;
        }

        await this.loadTemplateInfo();
        this.isLoading = false;
    }    

    async updateSession(): Promise<void> {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();

        if (!this.userId) {
            console.error('워크스페이스 로그인에 실패하였습니다.');
            return;
        }

        await this.updatePurchaseInfo();
    }

    async updatePurchaseInfo(): Promise<void> {
        const result = await UserService.updatePurchaseInfo(this.userId);

        this.purchaseInfo = result.purchaseInfo;
        this.hasLifeupPurchase = result.isPurchaser;
    }

    async loadTemplateInfo(): Promise<void> {
        if (!this.hasLifeupPurchase || !this.userId) {
            return;
        }

        try {
            const result = await this.userService.getLifeupTemplateInfo(
                this.userId
            );

            if (!result) {
                this.isLifeupTemplate = false;
                return;
            }

            this.isLifeupTemplate = result.templateName === 'LIFEUP';

            if (this.isLifeupTemplate) {
                this.templateVersion = result.version;
                this.serialNumber = '준비중'; // result.serialNumber;
                this.rootPageUrl = result.rootPageUrl;
            }
        } catch (error) {
            console.error('라이프업 템플릿 정보를 불러오지 못했습니다.', error);
            this.isLifeupTemplate = false;
        }
    }

    selectCover(coverId: string): void {
        this.selectedCover = coverId;
    }

    saveTemplateName(): void {
        console.log('템플릿 이름 저장:', this.templateName);
    }

    saveCover(): void {
        console.log('템플릿 커버 저장:', this.selectedCover);
    }

    openLifeup(): void {
        if (!this.rootPageUrl) {
            return;
        }

        window.open(this.rootPageUrl, '_blank');
    }
}