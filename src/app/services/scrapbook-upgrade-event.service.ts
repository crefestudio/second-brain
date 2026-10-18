import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { auth } from '../firebase';
import { TemplateId, TEMPLATE_PRODUCTS } from '../config/template-catalog';

@Injectable({ providedIn: 'root' })
export class ScrapbookUpgradeEventService {
  private readonly duration = 48 * 60 * 60 * 1000;
  private firstSeenAt = 0;
  isLoading = false;
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
    if (!workspaceId || !auth.currentUser) return;
    const result = await firstValueFrom(this.http.post<{ firstSeenAt: number; serverNow: number }>(
      'https://us-central1-notionable-secondbrain.cloudfunctions.net/getScrapbookUpgradeEvent', { workspaceId },
      { headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } }
    ));
    if (requestSequence !== this.requestSequence) return;
    this.firstSeenAt = result.firstSeenAt;
    this.clockOffset = result.serverNow - Date.now();
    } finally { if (requestSequence === this.requestSequence) this.isLoading = false; }
  }
  get isActive(): boolean { return Boolean(this.firstSeenAt) && this.remainingSeconds > 0; }
  get isPlanner(): boolean { return this.templateId === 'lifeupPlanner'; }
  get productName(): string { return TEMPLATE_PRODUCTS[this.templateId].nameKoShort; }
  get remainingSeconds(): number { return Math.max(0, Math.ceil((this.firstSeenAt + this.duration - Date.now() - this.clockOffset) / 1000)); }
  upgradeUrl(source: string): string { return this.rewardUrl(this.isActive, source); }
  normalUrl(source: string): string { return this.rewardUrl(false, source); }

  private rewardUrl(sale: boolean, source: string): string {
    const urls = TEMPLATE_PRODUCTS[this.templateId].salesUrls;
    const url = sale ? urls.rewardSale : urls.reward;
    const paths: Record<string, string> = {
      'https://notionable.net/shop_view?idx=9': 'lifeup-reward',
      'https://notionable.net/shop_view?idx=10': 'lifeup-reward-sale',
      'https://notionable.net/shop_view?idx=12': 'lifeup-reward-pack',
      'https://notionable.net/shop_view?idx=11': 'lifeup-reward-pack-sale'
    };
    return paths[url] ? this.storeUrl(paths[url], source) : url;
  }

  private storeUrl(product: string, source: string): string {
    return `https://app.notionable.net/store/${product}?from=${encodeURIComponent(source)}`;
  }
}
