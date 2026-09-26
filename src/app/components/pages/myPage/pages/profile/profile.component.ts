import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProfileSettings, ProfileSettingsService } from '../../../../../services/profile-settings.service';
import { SocialAuthService } from '../../../../../services/social-auth.service';

@Component({ selector: 'app-profile', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './profile.component.html', styleUrls: ['./profile.component.scss'] })
export class ProfileComponent implements OnInit {
    showDeletion = false; deletionAgreed = false; deletionConfirmation = ''; isDeleting = false; deletionError = '';
    async deleteAccount(): Promise<void> {
        if (this.isDeleting || this.isSaving || !this.deletionAgreed || this.deletionConfirmation !== '탈퇴') return;
        this.isDeleting = true; this.deletionError = '';
        try {
            await this.profileSettings.deleteAccount();
            window.alert('회원 탈퇴와 데이터 삭제가 완료되었습니다.');
            await this.socialAuth.logout();
        } catch (error) {
            this.deletionError = error instanceof Error ? error.message : '탈퇴를 완료하지 못했습니다.';
        } finally { this.isDeleting = false; }
    }
    isLoading = true; isSaving = false; errorMessage = ''; successMessage = '';
    profileName = ''; email = ''; phoneNumber = ''; createdAt = ''; provider = ''; marketingConsent = false; marketingConsentRequired = false; consentSelected = false;
    constructor(private readonly profileSettings: ProfileSettingsService, private readonly socialAuth: SocialAuthService) {}
    async ngOnInit(): Promise<void> { try { this.apply(await this.profileSettings.get()); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '프로필 정보를 불러오지 못했습니다.'; } finally { this.isLoading = false; } }
    async save(): Promise<void> { const displayName = this.profileName.trim(); if (!displayName) { this.errorMessage = '프로필명을 입력해주세요.'; return; } if (this.marketingConsentRequired && !this.consentSelected) { this.errorMessage = '마케팅 알림 수신 여부를 선택해주세요.'; return; } this.isSaving = true; this.errorMessage = ''; this.successMessage = ''; try { const result = await this.profileSettings.save(displayName, this.marketingConsent); this.profileName = result.displayName; this.marketingConsent = result.marketingConsent; this.marketingConsentRequired = false; await this.socialAuth.refreshAccount(); this.successMessage = '저장했습니다.'; } catch (error) { this.errorMessage = error instanceof Error ? error.message : '저장하지 못했습니다.'; } finally { this.isSaving = false; } }
    selectMarketingConsent(value: boolean): void { this.marketingConsent = value; this.consentSelected = true; }
    private apply(data: ProfileSettings): void { this.profileName = data.displayName; this.email = data.email; this.phoneNumber = data.phoneNumber; this.createdAt = this.formatDate(data.createdAt); this.provider = data.providers.join(', '); this.marketingConsent = data.marketingConsent; this.marketingConsentRequired = data.marketingConsentRequired === true; this.consentSelected = !this.marketingConsentRequired; }
    private formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ko-KR'); }
}
