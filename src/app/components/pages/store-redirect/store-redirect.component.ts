import { TEMPLATE_PRODUCTS } from '../../../config/template-catalog';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';

@Component({ selector: 'app-store-redirect', standalone: true, template: '<p>{{message}}</p>' })
export class StoreRedirectComponent implements OnInit {
    message = '';
    private readonly config = inject<AppConfig>(APP_CONFIG);
    private readonly destinations: Record<string, string> = {
        'store/lifeup-planner-lite': TEMPLATE_PRODUCTS.lifeupPlannerLite.salesUrls.normal,
        'store/lifeup': TEMPLATE_PRODUCTS.lifeUp.salesUrls.normal,
        'store/lifeup-planner': TEMPLATE_PRODUCTS.lifeupPlanner.salesUrls.normal,
        'store/lifeup-planner-reward': TEMPLATE_PRODUCTS.lifeupPlanner.salesUrls.reward,
        'store/lifeup-planner-reward-sale': TEMPLATE_PRODUCTS.lifeupPlanner.salesUrls.rewardSale,
        'store/lifeup-r': 'https://www.latpeed.com/products/HEPXz',
        'store/lifeup-reward': TEMPLATE_PRODUCTS.lifeUp.salesUrls.reward,
        'store/lifeup-reward-sale': TEMPLATE_PRODUCTS.lifeUp.salesUrls.rewardSale,
        'store/lifeup-reward-pack': 'https://notionable.net/shop_view?idx=12',
        'store/lifeup-reward-pack-sale': 'https://notionable.net/shop_view?idx=11',
        'store/lifeup-imweb': 'https://notionable.net/shop_view?idx=1',
        'store/lifeup-scrapbook': TEMPLATE_PRODUCTS.lifeUpScrapbook.salesUrls.normal,
        'store/bizup-custom': 'https://notionable.net/store/?idx=7'
    };
    constructor(private readonly route: ActivatedRoute) {}

    async ngOnInit(): Promise<void> {
        const productPath = (this.route.snapshot.routeConfig?.path || '').replace('store/', '');
        const destination = this.destinations[`store/${productPath}`];
        if (!destination) { this.message = '판매 페이지를 준비 중입니다.'; return; }
        const location = this.route.snapshot.queryParamMap.get('from') || '';
        // Keep historical analytics keys stable when public URLs change.
        const trackingProduct = productPath === 'lifeup' ? 'lifeup-imweb' : productPath === 'lifeup-r' ? 'lifeup'
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
