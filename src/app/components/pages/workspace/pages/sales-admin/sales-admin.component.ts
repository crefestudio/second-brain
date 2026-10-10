import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';

type Product = { name: string; price: number; storePath: string };

@Component({ selector: 'app-sales-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './sales-admin.component.html', styleUrl: './sales-admin.component.scss' })
export class SalesAdminComponent implements OnInit {
    allowed = false; errorMessage = ''; copiedPath = '';
    goals = { revenue: 5000000, averagePrice: 70000, trafficConversion: 3, purchaseConversion: 3 };
    readonly products: Product[] = [
        { name: '라이프업', price: 79000, storePath: 'lifeup' },
        { name: '라이프업 보상 구매', price: 69000, storePath: 'lifeup-reward' },
        { name: '라이프업 보상 타임세일', price: 64000, storePath: 'lifeup-reward-sale' },
        { name: '라이프업 스크랩북', price: 6600, storePath: 'lifeup-scrapbook' }
    ];
    constructor(private readonly care: CareRequestService) {}
    async ngOnInit(): Promise<void> { try { this.allowed = (await this.care.access()).isAdmin; if (!this.allowed) this.errorMessage = '관리자 계정으로 로그인해주세요.'; } catch { this.errorMessage = '관리자 권한을 확인하지 못했습니다.'; } }
    get goalPurchases(): number { return Math.ceil(this.goals.revenue / this.goals.averagePrice); }
    get goalProductInflows(): number { return Math.ceil(this.goalPurchases / (this.goals.purchaseConversion / 100)); }
    get goalSourceViews(): number { return Math.ceil(this.goalProductInflows / (this.goals.trafficConversion / 100)); }
    won(value: number): string { return `${value.toLocaleString('ko-KR')}원`; }
    async copyTrackingUrl(product: Product): Promise<void> {
        await navigator.clipboard.writeText(`${window.location.origin}/store/${product.storePath}?location=`);
        this.copiedPath = product.storePath;
        window.setTimeout(() => { if (this.copiedPath === product.storePath) this.copiedPath = ''; }, 1800);
    }
}
