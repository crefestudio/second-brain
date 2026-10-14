import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ScrapbookUpgradeEventService } from '../../../services/scrapbook-upgrade-event.service';
import { ScrapbookUpgradeCardComponent } from '../../common/scrapbook-upgrade-card.component';

@Component({
  selector: 'app-lifeup-scrapbook-upgrade',
  standalone: true,
  imports: [ScrapbookUpgradeCardComponent],
  template: `
    <main class="upgrade-page">
      @if (isLoading) {
        <div class="loading" role="status" aria-label="업그레이드 혜택 확인 중">
          <span class="loading-spinner"></span>
        </div>
      } @else {
        <app-scrapbook-upgrade-card [source]="source" />
      }
    </main>
  `,
  styleUrls: ['./lifeup-scrapbook-upgrade.component.css']
})
export class LifeupScrapbookUpgradeComponent {
  isLoading = true;
  readonly source: string;

  constructor(
    private authService: AuthService,
    private upgradeEvent: ScrapbookUpgradeEventService,
    route: ActivatedRoute
  ) {
    this.source = route.snapshot.queryParamMap.get('from') ?? 'upgrade_lifeup-scrapbook';
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.updateSession();
      await this.upgradeEvent.initialize(this.authService.getUserId());
    } catch {
      // The card falls back to the regular upgrade offer when event loading is unavailable.
    } finally {
      this.isLoading = false;
    }
  }
}
