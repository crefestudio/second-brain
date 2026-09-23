import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';
import { CsvValidation, LifeupPurchaser, PurchaserAdminService } from '../../../../../services/purchaser-admin.service';

type SortKey = 'purchasedAt' | 'email' | 'phone';
type MemberFilter = 'all' | 'standard' | 'premium';
type ProductOptionFilter = 'all' | 'standard' | 'premium' | 'upgrade';
type RegistrationFilter = 'all' | 'webhook' | 'file_added' | 'file_verified' | 'file_mismatch';
type NotifyFilter = 'all' | 'yes' | 'no';
@Component({ selector: 'app-purchaser-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './purchaser-admin.component.html', styleUrl: './purchaser-admin.component.scss' })
export class PurchaserAdminComponent implements OnInit {
    isLoading = true; errorMessage = ''; purchasers: LifeupPurchaser[] = []; selectedPurchaser: LifeupPurchaser | null = null;
    search = ''; sortKey: SortKey = 'purchasedAt'; memberFilter: MemberFilter = 'all'; productOptionFilter: ProductOptionFilter = 'all'; registrationFilter: RegistrationFilter = 'all'; notifyFilter: NotifyFilter = 'all';
    isValidatingCsv = false; csvMessage = ''; private validations = new Map<string, CsvValidation>(); private csvOnly: LifeupPurchaser[] = [];
    constructor(private readonly care: CareRequestService, private readonly purchaserAdmin: PurchaserAdminService) {}
    async ngOnInit(): Promise<void> { try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); this.purchasers = await this.purchaserAdmin.listLifeupPurchasers(); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '구매자 목록을 불러오지 못했습니다.'; } finally { this.isLoading = false; } }
    get filteredPurchasers(): LifeupPurchaser[] { const source = [...this.purchasers, ...this.csvOnly]; const term = this.search.trim().toLowerCase(); const searched = !term ? source : source.filter(p => [p.email, p.name, p.phone, p.purchaseOption, p.purchasedAt, this.serviceLabel(p), this.productOptionLabel(p)].join(' ').toLowerCase().includes(term)); const memberFiltered = this.memberFilter === 'all' ? searched : searched.filter(p => p.memberType === this.memberFilter); const productOptionFiltered = this.productOptionFilter === 'all' ? memberFiltered : memberFiltered.filter(p => this.productOption(p) === this.productOptionFilter); const registrationFiltered = this.registrationFilter === 'all' ? productOptionFiltered : productOptionFiltered.filter(p => this.registration(p) === this.registrationFilter); const filtered = this.notifyFilter === 'all' ? registrationFiltered : registrationFiltered.filter(p => this.notifyFilter === 'yes' ? p['notify'] === '예' : p['notify'] === '아니오'); return [...filtered].sort((a, b) => this.sortKey === 'purchasedAt' ? this.timestamp(b) - this.timestamp(a) : String(a[this.sortKey] || '').localeCompare(String(b[this.sortKey] || ''), 'ko')); }
    serviceLabel(p: LifeupPurchaser): string { return p.memberType === 'premium' ? '프리미엄' : p.memberType === 'standard' ? '일반' : '미대상'; }
    productOption(p: LifeupPurchaser): Exclude<ProductOptionFilter, 'all'> | null { return p.upgradeOnly ? 'upgrade' : p.memberType === 'premium' ? 'premium' : p.memberType === 'standard' ? 'standard' : null; }
    productOptionLabel(p: LifeupPurchaser): string { const option = this.productOption(p); return option ? ({ standard: '라이프업 - 일반', premium: '라이프업 - 프리미엄', upgrade: '프리미엄 승격' } as const)[option] : '-'; }
    toggleDetail(p: LifeupPurchaser): void { this.selectedPurchaser = this.selectedPurchaser?.id === p.id ? null : p; }
    detailEntries(p: LifeupPurchaser): Array<{ key: string; value: string }> { return Object.entries(p).map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '') })); }
    registration(p: LifeupPurchaser): CsvValidation['registrationStatus'] { return this.validations.get(p.id)?.registrationStatus || p['registrationStatus'] as CsvValidation['registrationStatus'] || 'webhook'; }
    registrationLabel(p: LifeupPurchaser): string { return ({ webhook: '래피드훅', file_added: '파일 추가', file_verified: '파일 검증', file_mismatch: '파일 불일치' } as const)[this.registration(p)]; }
    issues(p: LifeupPurchaser): string[] { return this.validations.get(p.id)?.issues || p['issues'] as string[] || []; }
    async onCsvSelected(event: Event): Promise<void> { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; this.isValidatingCsv = true; this.csvMessage = ''; try { const result = await this.purchaserAdmin.validateCsv(await file.text()); this.validations = new Map(result.results.filter(item => item.id && item.registrationStatus !== 'file_added').map(item => [item.id!, item])); this.csvOnly = []; this.purchasers = await this.purchaserAdmin.listLifeupPurchasers(); this.csvMessage = `${result.csvCount}건 대조 완료`; } catch (error) { this.csvMessage = error instanceof Error ? error.message : 'CSV 대조에 실패했습니다.'; } finally { this.isValidatingCsv = false; } }
    private timestamp(p: LifeupPurchaser): number { const m = String(p.purchasedAt || '').match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/); if (!m) return 0; return Date.UTC(Number(m[1]) < 100 ? 2000 + Number(m[1]) : Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)); }
}
