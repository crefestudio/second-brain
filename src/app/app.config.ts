import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

import { APP_CONFIG } from './config/app-config.token';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
    {
      provide: APP_CONFIG,
      useValue: {
        functionsBaseUrl: isDevMode()
          ? 'http://localhost:5001/notionable-secondbrain/us-central1'
          : 'https://us-central1-notionable-secondbrain.cloudfunctions.net',
      },
    },      
  ]
};
