import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';

@Component({ selector: 'app-store-redirect', standalone: true, template: '' })
export class StoreRedirectComponent implements OnInit {
    private readonly config = inject<AppConfig>(APP_CONFIG);
    private readonly destinations: Record<string, string> = {
        'store/lifeup': 'https://notionable.net/shop_view?idx=1',
        'store/lifeup-r': 'https://www.latpeed.com/products/HEPXz',
        'store/lifeup-reward': 'https://www.latpeed.com/products/ozVuQ',
        'store/lifeup-reward-sale': 'https://www.latpeed.com/products/Waljo',
        'store/lifeup-imweb': 'https://notionable.net/shop_view?idx=1',
        'store/lifeup-scrapbook': 'https://notionable.net/shop_view?idx=6'
    };
    constructor(private readonly route: ActivatedRoute) {}

    async ngOnInit(): Promise<void> {
        const productPath = (this.route.snapshot.routeConfig?.path || '').replace('store/', '');
        const destination = this.destinations[`store/${productPath}`];
        if (!destination) return;
        const location = this.route.snapshot.queryParamMap.get('location') || '';
        // Keep historical analytics keys stable when public URLs change.
        const trackingProduct = productPath === 'lifeup' ? 'lifeup-imweb' : productPath === 'lifeup-r' ? 'lifeup' : productPath;
        const sessionId = this.sessionId();
        try {
            await Promise.race([
                fetch(`${this.config.functionsBaseUrl}/recordStoreVisit`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
                    body: JSON.stringify({ productPath: trackingProduct, location, referrer: document.referrer, sessionId })
                }),
                new Promise(resolve => window.setTimeout(resolve, 700))
            ]);
        } catch { /* Tracking must never prevent the customer reaching the store. */ }
        window.location.replace(destination);
    }

    private sessionId(): string {
        const key = 'store-tracking-session';
        let id = sessionStorage.getItem(key);
        if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
        return id;
    }
}
