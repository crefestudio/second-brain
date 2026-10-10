import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { CareRequestService } from '../../../../../services/care-request.service';
import { SalesAdminService, StoreVisitSource } from '../../../../../services/sales-admin.service';
import { auth } from '../../../../../firebase';

type Product = { name: string; price: number; storePath: string; trackingKey?: string };
@Component({ selector: 'app-sales-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './sales-admin.component.html', styleUrl: './sales-admin.component.scss' })
export class SalesAdminComponent implements OnInit {
    allowed = false; errorMessage = ''; youtubeMessage = ''; copiedPath = ''; loadingSummary = false; resettingVisits = false; syncingYoutube = false; summaryMonth = ''; totalViews = 0; productViews: Record<string, number> = {}; productSales: Record<string, { count: number; revenue: number }> = {}; sources: StoreVisitSource[] = [];
    goals = { revenue: 5000000, averagePrice: 70000, trafficConversion: 3, purchaseConversion: 3 };
    readonly products: Product[] = [
        { name: '라이프업 (래피드)', price: 79000, storePath: 'lifeup-r', trackingKey: 'lifeup' }, { name: '라이프업 보상 (래피드)', price: 69000, storePath: 'lifeup-reward' },
        { name: '라이프업 보상 타임세일 (래피드)', price: 64000, storePath: 'lifeup-reward-sale' }, { name: '라이프업 (아임웹)', price: 79000, storePath: 'lifeup', trackingKey: 'lifeup-imweb' },
        { name: '라이프업 스크랩북 (아임웹)', price: 0, storePath: 'lifeup-scrapbook' }
    ];
    constructor(private readonly care: CareRequestService, private readonly sales: SalesAdminService) {}
    async ngOnInit(): Promise<void> { try { this.allowed = (await this.care.access()).isAdmin; if (!this.allowed) this.errorMessage = '관리자 계정으로 로그인해주세요.'; else await this.loadSummary(); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '관리자 권한을 확인하지 못했습니다.'; } }
    get goalPurchases(): number { return Math.ceil(this.goals.revenue / this.goals.averagePrice); }
    get goalProductInflows(): number { return Math.ceil(this.goalPurchases / (this.goals.purchaseConversion / 100)); }
    get goalSourceViews(): number { return Math.ceil(this.goalProductInflows / (this.goals.trafficConversion / 100)); }
    get actualPurchases(): number { return Object.values(this.productSales).reduce((sum, product) => sum + product.count, 0); }
    get actualRevenue(): number { return Object.values(this.productSales).reduce((sum, product) => sum + product.revenue, 0); }
    get measuredSources(): StoreVisitSource[] { return this.sources.filter(source => typeof source.sourceViews === 'number' && Number.isFinite(source.sourceViews) && source.sourceViews >= 0); }
    get actualSourceViews(): number | null { const sources = this.measuredSources; return sources.length ? sources.reduce((sum, source) => sum + source.sourceViews!, 0) : null; }
    get partialSourceViews(): boolean { return this.measuredSources.length < this.sources.length; }
    get actualTrafficConversion(): number | null { const views = this.actualSourceViews; return views !== null && views > 0 ? this.measuredSources.reduce((sum, source) => sum + source.count, 0) / views * 100 : null; }
    get actualPurchaseConversion(): number | null { return this.totalViews > 0 ? this.actualPurchases / this.totalViews * 100 : null; }
    purchaseConversion(product: Product): number | null { return this.views(product) > 0 ? this.salesCount(product) / this.views(product) * 100 : null; }
    won(value: number): string { return `${value.toLocaleString('ko-KR')}원`; }
    views(product: Product): number { return this.productViews[product.trackingKey || product.storePath] || 0; }
    salesCount(product: Product): number { return this.productSales[product.trackingKey || product.storePath]?.count || 0; }
    salesRevenue(product: Product): number { return this.productSales[product.trackingKey || product.storePath]?.revenue || 0; }
    sourceViews(source: StoreVisitSource): string { return typeof source.sourceViews === 'number' ? `${source.sourceViews.toLocaleString('ko-KR')}회` : 'YouTube 연결 필요'; }
    sourceConversion(source: StoreVisitSource): number | null { return typeof source.sourceViews === 'number' && source.sourceViews > 0 ? (source.count / source.sourceViews) * 100 : null; }
    belowSourceGoal(source: StoreVisitSource): boolean { const conversion = this.sourceConversion(source); return conversion !== null && conversion < this.goals.trafficConversion; }
    isYoutubeVideoId(value: string): boolean { return /^[A-Za-z0-9_-]{11}$/.test(value); }
    youtubeUrl(videoId: string): string { return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`; }
    async loadSummary(): Promise<void> { this.loadingSummary = true; try { const summary = await this.sales.summary(); this.summaryMonth = summary.month; this.totalViews = summary.totalViews; this.productViews = summary.productViews; this.productSales = summary.productSales || {}; this.sources = summary.sources; } finally { this.loadingSummary = false; } }
    async resetMonthlyVisits(): Promise<void> { if (this.resettingVisits) return; this.resettingVisits = true; try { await this.sales.resetMonthlyVisits(); await this.loadSummary(); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '유입 기록을 초기화하지 못했습니다.'; } finally { this.resettingVisits = false; } }
    async connectYoutube(): Promise<void> {
        if (this.syncingYoutube) return;
        this.syncingYoutube = true; this.youtubeMessage = '';
        const youtubeApp = initializeApp(auth.app.options, `youtube-${Date.now()}`);
        try {
            const adminToken = await auth.currentUser?.getIdToken();
            if (!adminToken) throw new Error('관리자 로그인이 필요합니다.');
            const youtubeAuth = getAuth(youtubeApp);
            await setPersistence(youtubeAuth, inMemoryPersistence);
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/yt-analytics.readonly');
            provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
            provider.setCustomParameters({ prompt: 'select_account consent', access_type: 'online' });
            const result = await signInWithPopup(youtubeAuth, provider);
            const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
            if (!accessToken) throw new Error('YouTube 권한 토큰을 받지 못했습니다.');
            this.youtubeMessage = await this.sales.syncYoutube(accessToken, adminToken);
            await this.loadSummary();
        } catch (error) { this.youtubeMessage = error instanceof Error ? error.message : 'YouTube 연결에 실패했습니다.'; }
        finally { await deleteApp(youtubeApp); this.syncingYoutube = false; }
    }
    async copyTrackingUrl(product: Product): Promise<void> { await navigator.clipboard.writeText(`${window.location.origin}/store/${product.storePath}?location=`); this.copiedPath = product.storePath; window.setTimeout(() => { if (this.copiedPath === product.storePath) this.copiedPath = ''; }, 1800); }
}
