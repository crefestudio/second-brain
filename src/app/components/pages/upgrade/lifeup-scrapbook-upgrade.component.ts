import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TemplateUpgradeEventService } from '../../../services/template-upgrade-event.service';
import { ScrapbookUpgradeCardComponent } from '../../common/scrapbook-upgrade-card.component';
import { TemplateId } from '../../../config/template-catalog';

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
  readonly templateId: TemplateId;

  constructor(
    private authService: AuthService,
    private upgradeEvent: TemplateUpgradeEventService,
    route: ActivatedRoute
  ) {
    this.source = route.snapshot.queryParamMap.get('from') ?? 'upgrade_lifeup-scrapbook';
    this.templateId = route.snapshot.data['templateId'] === 'lifeUpSecondBrainOS' ? 'lifeUpSecondBrainOS' : route.snapshot.data['templateId'] === 'lifeupPlannerLite' ? 'lifeupPlannerLite' : route.snapshot.data['templateId'] === 'lifeupPlanner' ? 'lifeupPlanner' : 'lifeUpScrapbook';
  }

  async ngOnInit(): Promise<void> {
    try {
      // The upgrade URL identifies its source template. Resolve that exact
      // workspace instead of the account's default workspace so its event
      // window and reward price are used.
      await this.authService.updateSession(this.templateId);
      await this.upgradeEvent.initialize(this.authService.getUserId(), this.templateId);
    } catch {
      // The card falls back to the regular upgrade offer when event loading is unavailable.
    } finally {
      this.isLoading = false;
    }
  }
}
