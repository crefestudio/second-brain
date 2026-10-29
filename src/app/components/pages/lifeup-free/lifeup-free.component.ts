import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONFIG } from '../../../config/app-config.token';
import { giftApplicationError, isYoutubeCommentHandle, normalizeYoutubeHandle } from '../../../../../functions/src/lifeup-gift';
import { TEMPLATE_PRODUCTS } from '../../../config/template-catalog';

@Component({
  selector: 'app-lifeup-free', standalone: true,
  imports: [FormsModule],
  templateUrl: './lifeup-free.component.html', styleUrl: './lifeup-free.component.scss'
})
export class LifeupFreeComponent {
  private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
  youtubeHandle = '';
  email = '';
  subscribedAndLiked = false;
  commented = false;
  completed = false;
  marketingConsent = true;
  readonly gifts = [
    { name: '라이프업 플래너 Lite', url: TEMPLATE_PRODUCTS.lifeupPlannerLite.salesUrls.normal + '?from=gift' },
    { name: '스크랩북', url: TEMPLATE_PRODUCTS.lifeUpScrapbook.salesUrls.normal + '?from=gift' },
    { name: '세컨드 OS Lite', url: TEMPLATE_PRODUCTS.lifeUpSecondBrainOSLite.salesUrls.normal + '?from=gift' }
  ];
  busy = false;
  error = '';

  get validYoutubeHandle(): boolean { return isYoutubeCommentHandle(this.youtubeHandle); }
  get canClaim(): boolean { return giftApplicationError(this) === null; }

  normalizeHandle(): void { this.youtubeHandle = normalizeYoutubeHandle(this.youtubeHandle); }

  async claim(): Promise<void> {
    if (!this.canClaim || this.busy) return;
    this.normalizeHandle();
    this.busy = true;
    this.error = '';
    try {
      const response = await fetch(`${this.baseUrl}/claimLifeupFreeTemplates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeHandle: this.youtubeHandle.trim(), email: this.email.trim(), subscribedAndLiked: this.subscribedAndLiked, commented: this.commented, marketingConsent: this.marketingConsent })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || '템플릿을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      this.completed = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : '템플릿을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    } finally { this.busy = false; }
  }
}
