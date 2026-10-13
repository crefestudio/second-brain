import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { APP_CONFIG } from '../../../config/app-config.token';

@Component({
  selector: 'app-lifeup-free', standalone: true,
  imports: [FormsModule],
  templateUrl: './lifeup-free.component.html', styleUrl: './lifeup-free.component.scss'
})
export class LifeupFreeComponent {
  private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
  email = '';
  marketingConsent = false;
  busy = false;
  error = '';
  confirming = false;

  get canClaim(): boolean { return /^\S+@\S+\.\S+$/.test(this.email.trim()); }

  async claim(): Promise<void> {
    if (!this.canClaim || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const response = await fetch(`${this.baseUrl}/claimLifeupFreeScrapbook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email.trim().toLowerCase(), marketingConsent: this.marketingConsent })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.downloadPath) throw new Error(result.error || '템플릿을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      window.location.assign(result.downloadPath);
    } catch (error) {
      this.error = error instanceof Error ? error.message : '템플릿을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    } finally { this.busy = false; }
  }
}
