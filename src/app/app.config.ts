import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

import { APP_CONFIG } from './config/app-config.token';

import {
    provideAppInitializer,
    inject
} from '@angular/core';

import { SocialAuthService } from './services/social-auth.service';


export const appConfig: ApplicationConfig = {
    providers: [
        provideAppInitializer(() => {
            const authBridge = inject(SocialAuthService);
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
                lifeUpReleaseUrls: {
                    '1.5': 'https://internal-kingfisher-bbf.notion.site/L-I-F-E-U-P-1-5-3e3eea79fd8c80b39dc7e4aa9c8982ec?source=copy_link',
                },
                lifeUpPassportUrls: {
                    '1.5': '/templateDownload/LifeUp1.5.pdf',
                },
            },
        },
    ]
};
