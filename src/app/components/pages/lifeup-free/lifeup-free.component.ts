import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../../config/app-config.token';

type TemplateId = 'lifeUp' | 'lifeUpScrapbook';
type GiftTemplate = { id: TemplateId; name: string; enabled: boolean; selected: boolean; description: string };
type ClaimedTemplate = { id: TemplateId; name: string; downloadPath: string };

@Component({
  selector: 'app-lifeup-free', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lifeup-free.component.html', styleUrl: './lifeup-free.component.scss'
})
export class LifeupFreeComponent {
  private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
  readonly maxSelections = 2;
  templates: GiftTemplate[] = [
    { id: 'lifeUp', name: '라이프업 1.5 GTD 할일', enabled: false, selected: false, description: '준비 중' },
    { id: 'lifeUp', name: '라이프업 1.5 PARA 노트', enabled: false, selected: false, description: '준비 중' },
    { id: 'lifeUp', name: '라이프업 1.5 메모장', enabled: false, selected: false, description: '준비 중' },
    { id: 'lifeUpScrapbook', name: '라이프업 1.5 스크랩북', enabled: true, selected: false, description: '무료 증정' },
    { id: 'lifeUp', name: '라이프업 1.5 연락처', enabled: false, selected: false, description: '준비 중' },
    { id: 'lifeUp', name: '라이프업 1.5 루틴', enabled: false, selected: false, description: '준비 중' }
  ];
  email = '';
  marketingConsent = false;
  code = '';
  step: 'form' | 'code' | 'complete' = 'form';
  busy = false;
  error = '';
  claimed: ClaimedTemplate[] = [];

  get selected(): GiftTemplate[] { return this.templates.filter(template => template.selected); }
  get canRequest(): boolean { return this.selected.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()); }

  toggle(template: GiftTemplate): void {
    if (!template.enabled) return;
    if (!template.selected && this.selected.length >= this.maxSelections) {
      this.error = `무료 템플릿은 최대 ${this.maxSelections}개까지 선택할 수 있습니다.`;
      return;
    }
    this.error = '';
    template.selected = !template.selected;
  }

  private async post<T>(endpoint: string, body: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return result as T;
  }

  async requestCode(): Promise<void> {
    if (!this.canRequest || this.busy) return;
    this.busy = true; this.error = '';
    try {
      await this.post('requestLifeupFreeCode', { email: this.email.trim().toLowerCase(),
        templates: this.selected.map(template => template.id), marketingConsent: this.marketingConsent });
      this.code = ''; this.step = 'code';
    } catch (error) { this.error = error instanceof Error ? error.message : '인증 메일 발송에 실패했습니다.'; }
    finally { this.busy = false; }
  }

  async confirmCode(): Promise<void> {
    if (this.busy || !/^\d{6}$/.test(this.code)) { this.error = '이메일로 받은 6자리 인증번호를 입력해 주세요.'; return; }
    this.busy = true; this.error = '';
    try {
      const result = await this.post<{ templates: ClaimedTemplate[] }>('redeemLifeupFreeTemplates', {
        email: this.email.trim().toLowerCase(), code: this.code
      });
      this.claimed = result.templates; this.step = 'complete';
    } catch (error) { this.error = error instanceof Error ? error.message : '인증 처리에 실패했습니다.'; }
    finally { this.busy = false; }
  }
}
