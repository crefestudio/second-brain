import { InjectionToken } from '@angular/core';

export interface AppConfig {
  functionsBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');
