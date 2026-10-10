import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { auth } from '../firebase';

@Injectable({ providedIn: 'root' })
export class ScrapbookUpgradeEventService {
  private readonly duration = 48 * 60 * 60 * 1000;
  private firstSeenAt = 0;
  isLoading = false;
  private clockOffset = 0;
  readonly saleUrl = 'https://www.latpeed.com/products/Waljo';
  readonly normalUrl = 'https://www.latpeed.com/products/ozVuQ';
  constructor(private http: HttpClient) {}
  async initialize(workspaceId: string): Promise<void> {
    this.isLoading = true;
    try {
    this.firstSeenAt = 0;
    if (!workspaceId || !auth.currentUser) return;
    const result = await firstValueFrom(this.http.post<{ firstSeenAt: number; serverNow: number }>(
      'https://us-central1-notionable-secondbrain.cloudfunctions.net/getScrapbookUpgradeEvent', { workspaceId },
      { headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } }
    ));
    this.firstSeenAt = result.firstSeenAt;
    this.clockOffset = result.serverNow - Date.now();
    } finally { this.isLoading = false; }
  }
  get isActive(): boolean { return Boolean(this.firstSeenAt) && this.remainingSeconds > 0; }
  get remainingSeconds(): number { return Math.max(0, Math.ceil((this.firstSeenAt + this.duration - Date.now() - this.clockOffset) / 1000)); }
  get upgradeUrl(): string { return this.isActive ? this.saleUrl : this.normalUrl; }
}
