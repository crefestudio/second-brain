import { InjectionToken } from '@angular/core';

export interface AppConfig {
  functionsBaseUrl: string;
  lifeUpReleaseUrls: Record<string, string>;
  lifeUpPassportUrls: Record<string, string>;
  lifeUpScrapbookReleaseUrls: Record<string, string>;
  lifeUpScrapbookPassportUrls: Record<string, string>;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');
