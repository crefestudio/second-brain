import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { auth } from '../firebase';
import { TemplateId, TEMPLATE_PRODUCTS } from '../config/template-catalog';

@Injectable({ providedIn: 'root' })
export class TemplateUpgradeEventService {
  private readonly duration = 48 * 60 * 60 * 1000;
  private firstSeenAt = 0;
  isLoading = false;
  bannerDismissed = false;
  private clockOffset = 0;
  private templateId: TemplateId = 'lifeUpScrapbook';
  private requestSequence = 0;
  constructor(private http: HttpClient) {}
  async initialize(workspaceId: string, templateId: TemplateId = 'lifeUpScrapbook'): Promise<void> {
    const requestSequence = ++this.requestSequence;
    this.templateId = templateId;
    this.isLoading = true;
    try {
    this.firstSeenAt = 0;
    this.bannerDismissed = false;
    if (!workspaceId || !auth.currentUser) return;
    const result = await firstValueFrom(this.http.post<{ firstSeenAt: number; serverNow: number; bannerDismissed?: boolean }>(
      'https://us-central1-notionable-secondbrain.cloudfunctions.net/getScrapbookUpgradeEvent', { workspaceId },
      { headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } }
    ));
    if (requestSequence !== this.requestSequence) return;
    this.firstSeenAt = result.firstSeenAt;
    this.bannerDismissed = result.bannerDismissed === true;
    this.clockOffset = result.serverNow - Date.now();
    } finally { if (requestSequence === this.requestSequence) this.isLoading = false; }
  }
  get isActive(): boolean { return Boolean(this.firstSeenAt) && this.remainingSeconds > 0; }
  async dismissBanner(workspaceId: string): Promise<void> {
    if (!auth.currentUser || !workspaceId) throw new Error('LOGIN_REQUIRED');
    await firstValueFrom(this.http.post(
      'https://us-central1-notionable-secondbrain.cloudfunctions.net/getScrapbookUpgradeEvent',
      { workspaceId, dismissBanner: true },
      { headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } }
    ));
    this.bannerDismissed = true;
  }
  get isPlanner(): boolean { return this.templateId === 'lifeupPlanner'; }
  get hasPackUpgrade(): boolean { return this.isPlanner || this.templateId === 'lifeUpSecondBrainOS'; }
  get productName(): string { return TEMPLATE_PRODUCTS[this.templateId].nameKoShort; }
  get remainingSeconds(): number { return Math.max(0, Math.ceil((this.firstSeenAt + this.duration - Date.now() - this.clockOffset) / 1000)); }
  upgradeUrl(source: string): string { return this.rewardUrl(this.isActive, source); }
  normalUrl(source: string): string { return this.rewardUrl(false, source); }

  private rewardUrl(sale: boolean, source: string): string {
    const urls = TEMPLATE_PRODUCTS[this.templateId].salesUrls;
    const url = sale ? urls.rewardSale : urls.reward;
    return `${url}?from=${encodeURIComponent(source)}`;
  }
}
