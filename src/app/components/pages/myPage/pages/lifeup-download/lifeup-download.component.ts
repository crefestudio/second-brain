import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { UserService } from '../../../../../services/user.service';

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

    readonly downloadUrl = 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3e1eea79fd8c805f8efdf9db34862c43?source=copy_link';
    readonly reviewUrl = 'https://notionable.net/store/?idx=1';
    readonly passportUrl = '/templateDownload/LifeUp-1.3-Template-Passport.pdf';

    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly router: Router
    ) {}

    async ngOnInit(): Promise<void> {
        try {
            await this.loadPurchaseInfo();
        } finally {
            this.isLoading = false;
        }
    }

    private async loadPurchaseInfo(): Promise<void> {
        await this.authService.updateSession();
        const userId = this.authService.getUserId();

        if (!userId) {
            return;
        }

        const result = await UserService.updatePurchaseInfo(userId);
        this.isPurchaser = result.isPurchaser;
    }

    goToPurchaseInfo(): void {
        this.router.navigate(['/mypage/subscription']);
    }

    startVerification(): void {
        this.verificationError = '';
        this.verificationStep = 'lookup';
    }

    async verifyPurchase(): Promise<void> {
        const value = this.verificationValue.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const digits = value.replace(/\D/g, '');
        const phone = digits.length === 11 && digits.startsWith('010')
            ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
            : undefined;

        if (!isEmail && !phone) {
            this.verificationError = '구매하실 때 사용한 이메일 또는 휴대폰 번호를 입력해주세요.';
            return;
        }

        this.isVerifying = true;
        this.verificationError = '';
        try {
            const purchaser = await this.userService.verifyPurchaser(
                'lifeUp',
                isEmail ? value.toLowerCase() : undefined,
                phone
            );
            if (!purchaser?.email) {
                this.verificationError = '구매 정보를 찾을 수 없습니다. 입력 정보를 확인해주세요.';
                return;
            }

            this.purchaserEmail = purchaser.email;
            const sent = await this.userService.sendVerificationEmail(this.purchaserEmail);
            if (!sent) {
                this.verificationError = '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.';
                return;
            }
            this.verificationStep = 'code';
        } finally {
            this.isVerifying = false;
        }
    }

    async confirmVerification(): Promise<void> {
        if (!/^\d{6}$/.test(this.verificationCode)) {
            this.verificationError = '이메일로 받은 인증번호 6자리를 입력해주세요.';
            return;
        }

        this.isVerifying = true;
        this.verificationError = '';
        try {
            const result = await this.userService.verifyCode(
                this.purchaserEmail,
                this.verificationCode,
                this.authService.getMemberUid(),
                'lifeUp'
            );
            if (!result?.userId) {
                this.verificationError = result?.message || '구매 인증에 실패했습니다.';
                return;
            }

            await this.authService.updateSession();
            this.isPurchaser = true;
            this.verificationStep = 'intro';
        } finally {
            this.isVerifying = false;
        }
    }
}
