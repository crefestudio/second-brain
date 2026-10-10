import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { UserService } from '../../../../../services/user.service';
import { SocialAuthService } from '../../../../../services/social-auth.service';
import { APP_CONFIG } from '../../../../../config/app-config.token';

@Component({
    selector: 'app-lifeup-download',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './lifeup-download.component.html',
    styleUrls: ['./lifeup-download.component.scss']
})
export class LifeupDownloadComponent implements OnInit {
    isLoading = true;
    isPurchaser = false;
    verificationStep: 'intro' | 'lookup' | 'code' = 'intro';
    verificationValue = '';
    verificationCode = '';
    purchaserEmail = '';
    isVerifying = false;
    verificationError = '';
    private verificationUid: string | null = null;
    readonly templateId: 'lifeUp' | 'lifeUpScrapbook';
    readonly productName: string;

    readonly downloadUrl: string;
    readonly reviewUrl = 'https://notionable.net/lifeup-review';
    readonly passportUrl: string;
    readonly showReviewEvent: boolean;

    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly router: Router,
        private readonly socialAuth: SocialAuthService,
        route: ActivatedRoute
    ) {
        const config = inject(APP_CONFIG);
        this.templateId = route.snapshot.data['product'] === 'lifeUpScrapbook' ? 'lifeUpScrapbook' : 'lifeUp';
        const scrapbook = this.templateId === 'lifeUpScrapbook';
        this.productName = scrapbook ? '라이프업 1.5 스크랩북' : '라이프업 1.5';
        this.downloadUrl = (scrapbook ? config.lifeUpScrapbookReleaseUrls : config.lifeUpReleaseUrls)['1.5'];
        this.passportUrl = (scrapbook ? config.lifeUpScrapbookPassportUrls : config.lifeUpPassportUrls)['1.5'];
        this.showReviewEvent = !scrapbook;
    }

    async ngOnInit(): Promise<void> {
        try {
            await this.loadPurchaseInfo();
        } catch {
            this.verificationError = '구매 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.';
        } finally {
            this.isLoading = false;
        }
    }

    private async loadPurchaseInfo(): Promise<void> {
        this.isPurchaser = false;
        await this.authService.updateSession(this.templateId);
        const userId = this.authService.getUserId();

        if (!userId) {
            return;
        }

        const result = await UserService.updatePurchaseInfo(userId, this.templateId);
        this.isPurchaser = result.isPurchaser && result.purchaseInfo?.verified === true;
    }

    goToPurchaseInfo(): void {
        this.router.navigate(['/mypage/subscription']);
    }

    startVerification(): void {
        this.verificationError = '';
        this.verificationStep = 'lookup';
    }

    async verifyPurchase(): Promise<void> {
        if (this.isVerifying) return;
        const value = this.verificationValue.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

        if (!isEmail) {
            this.verificationError = '구매하실 때 사용한 이메일을 입력해주세요.';
            return;
        }

        this.isVerifying = true;
        this.verificationError = '';
        try {
            await this.socialAuth.init();
            this.verificationUid = this.socialAuth.account()?.uid ?? null;
            this.purchaserEmail = value.toLowerCase();
            const account = this.socialAuth.account();
            if (account && (!account.emailVerified || account.email?.trim().toLowerCase() !== this.purchaserEmail)) {
                this.verificationError = '구매 인증은 현재 라이프봇 계정의 이메일과 구매 이메일이 다르면 진행할 수 없습니다. 라이프봇에서 로그아웃한 후 다시 진행해 주세요.';
                return;
            }
            // Existing signed-in accounts link the purchase without switching identities.
            const sent = this.verificationUid
                ? await this.userService.sendVerificationEmail(this.purchaserEmail, this.templateId)
                : await this.socialAuth.requestPurchaseCode(this.purchaserEmail, this.templateId);
            if (!sent) {
                this.verificationError = this.verificationUid ? (this.userService.verificationEmailError || '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.')
                    : this.socialAuth.error();
                return;
            }
            this.verificationCode = '';
            this.verificationStep = 'code';
        } catch {
            this.verificationError = '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.';
        } finally {
            this.isVerifying = false;
        }
    }

    async confirmVerification(): Promise<void> {
        if (this.isVerifying) return;
        if (!/^\d{6}$/.test(this.verificationCode)) {
            this.verificationError = '이메일로 받은 인증번호 6자리를 입력해주세요.';
            return;
        }

        this.isVerifying = true;
        this.verificationError = '';
        try {
            if ((this.socialAuth.account()?.uid ?? null) !== this.verificationUid) {
                this.verificationError = '로그인 상태가 변경되었습니다. 새로고침 후 다시 인증해주세요.';
                return;
            }
            if (this.verificationUid) {
                const result = await this.userService.verifyCode(
                    this.purchaserEmail, this.verificationCode, this.verificationUid, this.templateId
                );
                if (!result?.userId) {
                    this.verificationError = result?.message || '구매 인증에 실패했습니다.';
                    return;
                }
            } else if (!await this.socialAuth.loginWithPurchase(this.purchaserEmail, this.verificationCode, this.templateId)) {
                this.verificationError = this.socialAuth.error();
                return;
            }
            await this.loadPurchaseInfo();
            if (!this.isPurchaser) {
                this.verificationError = '인증한 계정의 구매 정보를 확인할 수 없습니다. 새로고침 후 다시 확인해주세요.';
                return;
            }
            this.verificationCode = '';
            this.verificationStep = 'intro';
        } catch {
            this.verificationError = '구매 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.';
        } finally {
            this.isVerifying = false;
        }
    }
}
