import { TemplateId, TEMPLATE_PRODUCTS, templateIdOrLegacy } from '../../../../../config/template-catalog';
import { appEntryUrl, entryTemplate, safeAppReturn } from '../../../../../config/app-entry';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { UserService } from '../../../../../services/user.service';
import { SocialAuthService } from '../../../../../services/social-auth.service';
import { APP_CONFIG } from '../../../../../config/app-config.token';
import { TemplateUpgradeEventService } from '../../../../../services/template-upgrade-event.service';

@Component({
    selector: 'app-lifeup-download',
    standalone: true,
    providers: [TemplateUpgradeEventService],
    imports: [CommonModule, FormsModule],
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
    private readonly functionsBaseUrl: string;
    private readonly giftAccess: string | null;
    readonly verificationOnly: boolean;
    readonly chooseTemplate: boolean;
    private readonly returnUrl: string;
    readonly products = Object.entries(TEMPLATE_PRODUCTS).map(([id, product]) => ({ id, name: product.nameKoFull }));
    get lifebotUrl(): string { return appEntryUrl(this.templateId); }
    get connectUrl(): string { return appEntryUrl(this.templateId, 'connect'); }
    get accountEmail(): string { return this.socialAuth.account()?.email || ''; }
    async changeAccount(): Promise<void> {
        await this.socialAuth.logout(this.router.url);
    }
    selectTemplate(id: string): void {
        window.location.assign(this.router.createUrlTree(['/verify-purchase'], {
            queryParams: { templateId: id, returnUrl: this.returnUrl }
        }).toString());
    }
    readonly templateId: TemplateId;
    readonly productName: string;
    readonly isScrapbook: boolean;
    get isPlanner(): boolean { return this.templateId === 'lifeupPlanner'; }
    get isPlannerLite(): boolean { return this.templateId === 'lifeupPlannerLite'; }
    get isSecondBrainOS(): boolean { return TEMPLATE_PRODUCTS[this.templateId].kakaoCaptureScope === 'note'; }
    get hasPackUpgrade(): boolean { return TEMPLATE_PRODUCTS[this.templateId].upgradeKind === 'pack'; }
    get upgradeSource(): string { return `download_${TEMPLATE_PRODUCTS[this.templateId].slug}`; }
    get introductionVideoUrl(): string | null { return TEMPLATE_PRODUCTS[this.templateId].welcome.introductionVideoUrl; }

    readonly downloadUrl: string;
    readonly reviewUrl = 'https://notionable.net/lifeup-review';
    readonly passportUrl: string;
    readonly showReviewEvent: boolean;

    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
        private readonly router: Router,
        private readonly socialAuth: SocialAuthService,
        public readonly upgradeEvent: TemplateUpgradeEventService,
        route: ActivatedRoute
    ) {
        const config = inject(APP_CONFIG);
        this.functionsBaseUrl = config.functionsBaseUrl;
        this.giftAccess = route.snapshot.queryParamMap?.get('giftAccess') ?? null;
        this.verificationOnly = route.snapshot.data['verificationOnly'] === true;
        const target = entryTemplate(route.snapshot.queryParamMap?.get('templateId') ?? null);
        this.chooseTemplate = this.verificationOnly && !target;
        this.returnUrl = safeAppReturn(route.snapshot.queryParamMap?.get('returnUrl') ?? null);
        this.templateId = this.verificationOnly ? target || 'lifeUp' : templateIdOrLegacy(route.snapshot.data['product']);
        const scrapbook = this.templateId === 'lifeUpScrapbook';
        this.isScrapbook = scrapbook;
        this.productName = TEMPLATE_PRODUCTS[this.templateId].nameKoFull;
        this.downloadUrl = TEMPLATE_PRODUCTS[this.templateId].releaseUrl;
        this.passportUrl = '/templateDownload/' + TEMPLATE_PRODUCTS[this.templateId].pdfFileName;
        this.showReviewEvent = this.templateId === 'lifeUp';
    }

    async ngOnInit(): Promise<void> {
        try {
            if (this.verificationOnly) {
                const session = await this.socialAuth.session(undefined, this.chooseTemplate ? undefined : this.templateId);
                if (!session) {
                    await this.router.navigate(['/login'], { replaceUrl: true, queryParams: {
                        returnUrl: this.returnUrl, ...(!this.chooseTemplate ? { templateId: this.templateId } : {})
                    } });
                    return;
                }
                if (this.chooseTemplate) {
                    if (session.userId && entryTemplate(session.templateId)) {
                        window.location.replace(this.router.createUrlTree(['/verify-purchase'], { queryParams: {
                            templateId: session.templateId, returnUrl: this.returnUrl
                        } }).toString());
                    }
                    return;
                }
            }
            if (!this.verificationOnly && this.templateId === 'lifeUpScrapbook' && this.giftAccess) {
                const response = await fetch(`${this.functionsBaseUrl}/validateLifeupFreeScrapbookAccess`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: this.giftAccess })
                });
                if (response.ok) this.isPurchaser = true;
            }
            if (!this.isPurchaser) await this.loadPurchaseInfo();
            if (this.verificationOnly && this.isPurchaser) {
                await this.resumeApp();
                return;
            }
            await this.initializeUpgradeEvent();
        } catch {
            if (this.verificationOnly) {
                this.socialAuth.error.set('계정 정보를 불러오지 못했습니다. 잠시 후 계속하기를 눌러 다시 시도해주세요.');
                await this.router.navigate(['/login'], { replaceUrl: true, queryParams: {
                    returnUrl: this.returnUrl, ...(!this.chooseTemplate ? { templateId: this.templateId } : {})
                } });
                return;
            }
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

    private async initializeUpgradeEvent(): Promise<void> {
        if ((!this.isScrapbook && !this.isPlanner && !this.isPlannerLite && !this.isSecondBrainOS) || !this.isPurchaser) return;
        try {
            await this.upgradeEvent.initialize(this.authService.getUserId(), this.templateId);
        } catch {
            // When event status cannot be loaded, show the regular upgrade offer.
        }
    }

    private async resumeApp(): Promise<void> {
        const destination = this.router.parseUrl(this.returnUrl);
        destination.queryParams['templateId'] = this.templateId;
        await this.router.navigateByUrl(destination, { replaceUrl: true });
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
            if (this.verificationOnly) {
                await this.resumeApp();
                return;
            }
            await this.initializeUpgradeEvent();
            this.verificationCode = '';
            this.verificationStep = 'intro';
        } catch {
            this.verificationError = '구매 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.';
        } finally {
            this.isVerifying = false;
        }
    }
}
