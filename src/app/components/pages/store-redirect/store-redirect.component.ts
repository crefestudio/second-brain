import { TEMPLATE_PRODUCTS, TEMPLATE_IDS, templateSlugs, TEMPLATE_STORE_DESTINATIONS } from '../../../config/template-catalog';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';

@Component({ selector: 'app-store-redirect', standalone: true, template: '<p>{{message}}</p>' })
export class StoreRedirectComponent implements OnInit {
    message = '';
    private readonly config = inject<AppConfig>(APP_CONFIG);
    private readonly destinations: Record<string, string> = {
        ...TEMPLATE_STORE_DESTINATIONS,
        'store/lifeup-planner-reward': TEMPLATE_PRODUCTS.lifeupPlanner.checkoutUrls.reward,
        'store/lifeup-planner-reward-sale': TEMPLATE_PRODUCTS.lifeupPlanner.checkoutUrls.rewardSale,
        'store/lifeup-r': 'https://www.latpeed.com/products/HEPXz',
        'store/lifeup-reward': TEMPLATE_PRODUCTS.lifeUp.checkoutUrls.reward,
        'store/lifeup-reward-sale': TEMPLATE_PRODUCTS.lifeUp.checkoutUrls.rewardSale,
        'store/lifeup-reward-pack': TEMPLATE_PRODUCTS.lifeupPlanner.checkoutUrls.reward,
        'store/lifeup-reward-pack-sale': TEMPLATE_PRODUCTS.lifeupPlanner.checkoutUrls.rewardSale,
        'store/lifeup-imweb': 'https://notionable.net/store/?idx=1',
        'store/bizup-custom': 'https://notionable.net/store/?idx=7'
    };
    constructor(private readonly route: ActivatedRoute) {}

    async ngOnInit(): Promise<void> {
        const productPath = (this.route.snapshot.routeConfig?.path || '').replace('store/', '');
        const destination = this.destinations[`store/${productPath}`];
        if (!destination) { this.message = '판매 페이지를 준비 중입니다.'; return; }
        const location = this.route.snapshot.queryParamMap.get('from') || '';
        // Keep historical analytics keys stable when public URLs change.
        const templateId = TEMPLATE_IDS.find(id => templateSlugs(id).includes(productPath));
        const trackingProduct = templateId ? (templateId === 'lifeUp' ? 'lifeup-imweb' : TEMPLATE_PRODUCTS[templateId].slug) : productPath === 'lifeup-r' ? 'lifeup'
            : productPath === 'lifeup-planner-reward' ? 'lifeup-reward-pack'
            : productPath === 'lifeup-planner-reward-sale' ? 'lifeup-reward-pack-sale' : productPath;
        try {
            const sessionId = await this.sessionId();
            await Promise.race([
                fetch(`${this.config.functionsBaseUrl}/recordStoreVisit`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
                    body: JSON.stringify({ productPath: trackingProduct, location, referrer: document.referrer, sessionId, requestedAt: Date.now() })
                }),
                new Promise(resolve => window.setTimeout(resolve, 700))
            ]);
        } catch { /* Tracking must never prevent the customer reaching the store. */ }
        window.location.replace(destination);
    }

    private async sessionId(): Promise<string> {
        const getId = () => {
            const key = 'store-tracking-browser';
            try {
                let id = localStorage.getItem(key);
                if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
                return id;
            } catch {
                // Restricted storage must never prevent the store redirect.
                try {
                    let id = sessionStorage.getItem(key);
                    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
                    return id;
                } catch { return crypto.randomUUID(); }
            }
        };
        // Serialize first-time creation across tabs, then let Firestore atomically
        // accept only one event for this browser/product/source in 30 minutes.
        return navigator.locks ? navigator.locks.request('store-tracking-browser', getId) : getId();
    }
}
