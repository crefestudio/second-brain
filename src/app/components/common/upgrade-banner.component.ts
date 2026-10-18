import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { TemplateId } from '../../config/template-catalog';
import { ScrapbookUpgradeEventService } from '../../services/scrapbook-upgrade-event.service';

@Component({
  selector: 'app-upgrade-banner',
  standalone: true,
  providers: [ScrapbookUpgradeEventService],
  template: `
    @if (ready && !event.bannerDismissed) {
      <aside class="notice" aria-label="보상 업그레이드 혜택">
        <div class="content">
          @if (event.isActive) {
            <strong>할 일·메모·프로젝트를 한곳에서! 마감 직전 특별 혜택을 놓치지 마세요.</strong>
            <span>🎁 <span class="remaining">[<span role="timer">{{ remainingTime }}</span> 남음]</span> {{ event.isPlanner ? '플래너' : event.productName }} 사용자 전용 보상 업그레이드 특가!</span>
          } @else {
            <strong>모든 일상과 프로젝트를 라이프업 통합 템플릿 하나로 연결해 보세요.</strong>
            <span>🎁 {{ event.isPlanner ? '플래너' : event.productName }} 사용자를 위한 보상 업그레이드 특별가 혜택이 준비되어 있습니다.</span>
          }
          @if (error) { <span role="alert">닫기 상태를 저장하지 못했습니다. 다시 시도해 주세요.</span> }
        </div>
        <a [href]="event.upgradeUrl(source)" target="_blank" rel="noopener noreferrer">혜택 확인 하기</a>
        <button type="button" class="close" aria-label="이 워크스페이스에서 혜택 알림 다시 보지 않기" [disabled]="saving" (click)="dismiss()">×</button>
      </aside>
    }
  `,
  styles: [`
    :host { display: block; }
    .notice { display:flex; align-items:center; width:100%; box-sizing:border-box; min-height:42px; margin:0 0 18px; padding:7px 8px 7px 14px; border:1px solid #55447a; border-radius:12px; background:#292432; color:#aaa; font-size:14px; }
    .content { display:flex; flex-direction:column; flex:1; min-width:0; line-height:1.5; gap:3px; }
    strong { color:#b99bea; font-weight:600; }
    a { flex:0 0 auto; margin-left:12px; padding:5px 11px; border-radius:7px; background:#7655b5; color:#fff; font-size:13px; font-weight:600; text-decoration:none; white-space:nowrap; }
    .close { flex:0 0 26px; width:26px; height:26px; margin-left:8px; padding:0; border:0; border-radius:7px; background:transparent; color:#888; font-size:19px; cursor:pointer; }
    .close:hover { background:rgba(255,255,255,.06); color:#ccc; }
    .remaining { font-weight:700; }
    [role=timer] { color:#fbbf24; font-variant-numeric:tabular-nums; }
    @media(max-width:600px) { .notice { flex-wrap:wrap; gap:8px; } .content { flex-basis:calc(100% - 42px); } .close { order:1; align-self:flex-start; margin:0; } a { order:2; margin-left:0; } }
  `]
})
export class UpgradeBannerComponent implements OnChanges, OnDestroy {
  @Input() workspaceId = '';
  @Input() templateId: TemplateId = 'lifeUp';
  @Input() source = 'workspace_banner';
  ready = false;
  saving = false;
  error = false;
  remainingTime = '';
  private version = 0;
  private timer = setInterval(() => this.updateTime(), 1000);
  constructor(public event: ScrapbookUpgradeEventService) {}
  async ngOnChanges(): Promise<void> {
    const version = ++this.version;
    this.ready = false;
    this.error = false;
    if (!this.workspaceId || this.templateId === 'lifeUp') return;
    try {
      await this.event.initialize(this.workspaceId, this.templateId);
      if (version !== this.version) return;
      this.updateTime();
      this.ready = true;
    } catch { /* Leave the page available if the promotion cannot be loaded. */ }
  }
  private updateTime(): void {
    const seconds = this.event.remainingSeconds;
    this.remainingTime = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':');
  }
  async dismiss(): Promise<void> {
    this.saving = true;
    this.error = false;
    try { await this.event.dismissBanner(this.workspaceId); }
    catch { this.error = true; }
    finally { this.saving = false; }
  }
  ngOnDestroy(): void { this.version++; clearInterval(this.timer); }
}
