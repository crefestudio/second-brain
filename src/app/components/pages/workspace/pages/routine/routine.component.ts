import { canUseAgent } from '../../../../../config/template-catalog';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { TemplateUpgradeEventService } from '../../../../../services/template-upgrade-event.service';
import { Subscription } from 'rxjs';
import { ScrapbookUpgradeCardComponent } from '../../../../common/scrapbook-upgrade-card.component';

@Component({
  selector: 'app-routine',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ScrapbookUpgradeCardComponent
  ],
  templateUrl: './routine.component.html',
  styleUrls: ['./routine.component.css']
})
export class RoutineComponent {
  isLoading = true;
  canUseRoutine = false;
  sessionLoadFailed = false;
  hasWorkspace = false;
  isRecommendedHabits = false;

  showUpgradePopup = false;
  showUnsupportedNotice = false;
  remainingTime = '48:00:00';
  upgradeUrl = '';
  private timer?: ReturnType<typeof setInterval>;
  private navigation?: Subscription;
  private routeVersion = 0;

  constructor(private authService: AuthService, private router: Router, private upgradeEvent: TemplateUpgradeEventService) {
    this.upgradeUrl = this.upgradeEvent.normalUrl('routine');
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.updateSession();
      this.hasWorkspace = !!this.authService.getUserId();
      this.canUseRoutine = !this.authService.getUserId() || canUseAgent(this.authService.templateId, 'routine');
      await this.updatePopupForRoute(this.router.url);
      this.navigation = this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) this.updatePopupForRoute(event.urlAfterRedirects);
      });
    } catch {
      this.sessionLoadFailed = true;
    } finally {
      this.isLoading = false;
    }
  }

  closeUpgradePopup(): void { this.showUpgradePopup = false; }

  ngOnDestroy(): void { this.routeVersion++; clearInterval(this.timer); this.navigation?.unsubscribe(); }

  private async updatePopupForRoute(url: string): Promise<void> {
    const version = ++this.routeVersion;
    clearInterval(this.timer);
    this.showUpgradePopup = false;
    const eligible = /\/workspace\/routine\/(dashboard|myroutine)/.test(url);
    this.isRecommendedHabits = /\/workspace\/routine\/find(?:[?#]|$)/.test(url);
    this.showUnsupportedNotice = !this.canUseRoutine && eligible;
    if (this.canUseRoutine || !eligible) { this.showUpgradePopup = false; return; }
    try { await this.upgradeEvent.initialize(this.authService.getUserId(), this.authService.templateId); }
    catch { this.showUpgradePopup = false; this.upgradeUrl = this.upgradeEvent.normalUrl('routine'); return; }
    if (version !== this.routeVersion) return;
    this.upgradeUrl = this.upgradeEvent.upgradeUrl('routine');
    this.showUpgradePopup = this.upgradeEvent.isActive;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const seconds = this.upgradeEvent.remainingSeconds;
      this.remainingTime = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      if (!this.upgradeEvent.isActive) this.showUpgradePopup = false;
      this.upgradeUrl = this.upgradeEvent.upgradeUrl('routine');
    }, 1000);
  }
}
