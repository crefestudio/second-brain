import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

import { APP_CONFIG } from './config/app-config.token';

import {
    provideAppInitializer,
    inject
} from '@angular/core';

import { AuthBridgeService } from './services/auth-bridge.service';


export const appConfig: ApplicationConfig = {
    providers: [
        provideAppInitializer(() => {
            const authBridge = inject(AuthBridgeService);
            return authBridge.init();
        }),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        }),
        {
            provide: APP_CONFIG,
            useValue: {
                functionsBaseUrl: 'https://us-central1-notionable-secondbrain.cloudfunctions.net',
            },
        },
    ]
};
