import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ScrapbookUpgradeEventService } from '../../services/scrapbook-upgrade-event.service';

@Component({
  selector: 'app-scrapbook-upgrade-card',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #content>
    @if (event.isLoading) {
      <div role="status" aria-label="혜택 확인 중" style="min-height:400px"></div>
    } @else if (event.isActive) {
      <section class="card" aria-label="라이프업 업그레이드 혜택">
        @if (mode === 'popup') {
          <button type="button" class="close" aria-label="닫기" (click)="close()">×</button>
        }
        <div class="symbol" aria-hidden="true">✦</div>
        <h1>더 많은 기능을<br>라이프업에서 만나보세요</h1>
        <p class="intro">목표, 프로젝트, 할일, 메모, 자료를 한곳에서 관리하고 싶으시다면,<br><strong>라이프업 통합 템플릿으로 업그레이드해 보세요.</strong><br>🎁 스크랩북 사용자를 위한 <strong>보상 업그레이드 특별가 혜택</strong>을 만나보세요.</p>
        <section class="offer" aria-label="업그레이드 특별 혜택">
          <span class="badge">🎁 스크랩북 사용자 전용</span>
          <h2>48시간 한정 시크릿 혜택</h2>
          <div class="timer" role="timer" aria-label="혜택 종료까지 남은 시간">
            <span class="digit">{{ hours }}</span><span class="colon">:</span>
            <span class="digit">{{ minutes }}</span><span class="colon">:</span><span class="digit">{{ seconds }}</span>
          </div>
          <p class="timer-note">혜택 종료까지 남은 시간</p>
          <div class="price"><del>79,000원</del><span class="final-price">64,000<small>원</small></span></div>
          <p class="saving">지금 업그레이드하면 추가 15,000원 할인</p>
          <a class="cta" [href]="event.upgradeUrl" target="_blank" rel="noopener noreferrer">라이프업 업그레이드 알아보기 →</a>
        </section>
        @if (mode === 'popup') {
          <button type="button" class="later" (click)="close()">다음에 할게요</button>
        }
      </section>
    } @else {
      <section class="card regular">
        @if (mode === 'popup') {
          <button type="button" class="close" aria-label="닫기" (click)="close()">×</button>
        }
        <div class="symbol" aria-hidden="true">🧠</div>
        <h1>할 일 · 메모 · 프로젝트까지<br>한곳에서 관리하고 싶으시다면,</h1>
        <p class="intro"><strong>라이프업 통합 템플릿으로 업그레이드해 보세요.</strong><br>🎁 스크랩북 사용자를 위한 <strong>보상 업그레이드 특별가 혜택</strong>을 만나보세요.</p>
        <a class="cta" [href]="event.upgradeUrl" target="_blank" rel="noopener noreferrer">업그레이드 혜택 확인하기 →</a>
      </section>
    }
    </ng-template>
    @if (mode === 'popup') {
      <dialog #popup aria-label="라이프업 업그레이드 혜택" (cancel)="$event.preventDefault(); close()">
        <ng-container *ngTemplateOutlet="content" />
      </dialog>
    } @else {
      <ng-container *ngTemplateOutlet="content" />
    }
  `,
  styleUrls: ['./scrapbook-upgrade-card.component.css']
})
export class ScrapbookUpgradeCardComponent implements AfterViewInit, OnDestroy {
  @Input() mode: 'inline' | 'popup' = 'inline';
  @Output() closed = new EventEmitter<void>();
  @ViewChild('popup') popup?: ElementRef<HTMLDialogElement>;
  private timer = setInterval(() => this.changeDetector.markForCheck(), 1000);
  constructor(public event: ScrapbookUpgradeEventService, private changeDetector: ChangeDetectorRef) {}
  ngAfterViewInit(): void { this.popup?.nativeElement.showModal(); }
  close(): void {
    if (this.mode === 'popup') {
      this.popup?.nativeElement.close();
      this.closed.emit();
    }
  }
  get hours(): string { return String(Math.floor(this.event.remainingSeconds / 3600)).padStart(2, '0'); }
  get minutes(): string { return String(Math.floor(this.event.remainingSeconds % 3600 / 60)).padStart(2, '0'); }
  get seconds(): string { return String(this.event.remainingSeconds % 60).padStart(2, '0'); }
  ngOnDestroy(): void { clearInterval(this.timer); }
}
