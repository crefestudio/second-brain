import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';
import { CsvValidation, LifeupPurchaser, ManualLifeupPurchase, PurchaserAdminService } from '../../../../../services/purchaser-admin.service';
import { CreatedInvitation, InvitationTier, PurchaseInvitationService } from '../../../../../services/purchase-invitation.service';

type SortKey = 'purchasedAt' | 'email' | 'phone';
type MemberFilter = 'all' | 'standard' | 'premium' | 'other';
type ProductOptionFilter = 'all' | 'standard' | 'premium' | 'upgrade' | 'scrapbook';
type RegistrationFilter = 'all' | 'webhook' | 'file_added' | 'file_verified' | 'file_mismatch' | 'invitation' | 'manual';
type NotifyFilter = 'all' | 'yes' | 'no';
@Component({ selector: 'app-purchaser-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './purchaser-admin.component.html', styleUrl: './purchaser-admin.component.scss' })
export class PurchaserAdminComponent implements OnInit {
    isLoading = true; errorMessage = ''; purchasers: LifeupPurchaser[] = []; selectedPurchaser: LifeupPurchaser | null = null;
    search = ''; sortKey: SortKey = 'purchasedAt'; memberFilter: MemberFilter = 'all'; productOptionFilter: ProductOptionFilter = 'all'; registrationFilter: RegistrationFilter = 'all'; notifyFilter: NotifyFilter = 'all';
    isValidatingCsv = false; csvMessage = ''; private validations = new Map<string, CsvValidation>(); private csvOnly: LifeupPurchaser[] = [];
    isSyncingImweb = false; imwebSyncMessage = '';
    manualOpen = false; manualBusy = false; manualMessage = ''; manualError = '';
    manualPurchase: ManualLifeupPurchase = { name: '', email: '', phone: '', product: 'standard', amount: 0, purchasedAt: this.localDateTime() };
    inviteOpen = false; inviteEmail = ''; inviteTier: InvitationTier = 'standard'; inviteBusy = false; inviteError = ''; inviteCopied = false;
    invitation: CreatedInvitation | null = null;
    constructor(private readonly care: CareRequestService, private readonly purchaserAdmin: PurchaserAdminService, private readonly invitations: PurchaseInvitationService) {}
    async createInvitation(): Promise<void> {
        if (this.inviteBusy) return;
        this.inviteBusy = true; this.inviteError = ''; this.invitation = null; this.inviteCopied = false;
        try { this.invitation = await this.invitations.create(this.inviteEmail, this.inviteTier); }
        catch (error) { this.inviteError = error instanceof Error ? error.message : '초대 링크 생성에 실패했습니다.'; }
        finally { this.inviteBusy = false; }
    }
    async copyInvitation(): Promise<void> {
        if (!this.invitation) return;
        try { await navigator.clipboard.writeText(this.invitation.url); this.inviteCopied = true; this.inviteError = ''; }
        catch { this.inviteError = '링크를 선택해 직접 복사해주세요.'; }
    }
    async ngOnInit(): Promise<void> { try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); this.purchasers = await this.purchaserAdmin.listLifeupPurchasers(); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '구매자 목록을 불러오지 못했습니다.'; } finally { this.isLoading = false; } }
    get filteredPurchasers(): LifeupPurchaser[] { const source = [...this.purchasers, ...this.csvOnly]; const term = this.search.trim().toLowerCase(); const searched = !term ? source : source.filter(p => [p.email, p.name, p.phone, p.purchaseOption, p.purchasedAt, this.serviceLabel(p), this.productOptionLabel(p)].join(' ').toLowerCase().includes(term)); const memberFiltered = this.memberFilter === 'all' ? searched : searched.filter(p => this.memberFilter === 'other' ? !['standard', 'premium'].includes(String(p.memberType || '')) : p.memberType === this.memberFilter); const productOptionFiltered = this.productOptionFilter === 'all' ? memberFiltered : memberFiltered.filter(p => this.productOption(p) === this.productOptionFilter); const registrationFiltered = this.registrationFilter === 'all' ? productOptionFiltered : productOptionFiltered.filter(p => this.registration(p) === this.registrationFilter); const filtered = this.notifyFilter === 'all' ? registrationFiltered : registrationFiltered.filter(p => this.notifyFilter === 'yes' ? p['notify'] === '예' : p['notify'] === '아니오'); return [...filtered].sort((a, b) => this.sortKey === 'purchasedAt' ? this.timestamp(b) - this.timestamp(a) : String(a[this.sortKey] || '').localeCompare(String(b[this.sortKey] || ''), 'ko')); }
    serviceLabel(p: LifeupPurchaser): string { return p['templateId'] === 'lifeUpScrapbook' ? '기타' : p.memberType === 'premium' ? '라이프업 프리미엄' : p.memberType === 'standard' ? '라이프업' : '기타'; }
    productOption(p: LifeupPurchaser): Exclude<ProductOptionFilter, 'all'> | null { return p['templateId'] === 'lifeUpScrapbook' ? 'scrapbook' : p.upgradeOnly ? 'upgrade' : p.memberType === 'premium' ? 'premium' : p.memberType === 'standard' ? 'standard' : null; }
    productOptionLabel(p: LifeupPurchaser): string { const option = this.productOption(p); return option ? ({ standard: '라이프업', premium: '라이프업 프리미엄', upgrade: '라이프업 프리미엄 승격', scrapbook: '라이프업 스크랩북' } as const)[option] : String(p.purchaseOption || '-'); }
    toggleDetail(p: LifeupPurchaser): void { this.selectedPurchaser = this.selectedPurchaser?.id === p.id ? null : p; }
    detailEntries(p: LifeupPurchaser): Array<{ key: string; value: string }> { return Object.entries(p).map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '') })); }
    registration(p: LifeupPurchaser): Exclude<RegistrationFilter, 'all'> { if (p['source'] === 'manual') return 'manual'; if (p['source'] === 'invitation') return 'invitation'; return this.validations.get(p.id)?.registrationStatus || p['registrationStatus'] as CsvValidation['registrationStatus'] || 'webhook'; }
    registrationLabel(p: LifeupPurchaser): string { if (p['source'] === 'imweb') return '아임웹'; return ({ webhook: '래피드훅', manual: '수기 등록', file_added: '파일 추가', file_verified: '파일 검증', file_mismatch: '파일 불일치', invitation: '초대장' } as const)[this.registration(p)]; }
    issues(p: LifeupPurchaser): string[] { return (this.validations.get(p.id)?.issues || p['issues'] as string[] || []).filter(issue => issue !== '일치하는 래피드훅 구매 기록이 없습니다.'); }
    async onCsvSelected(event: Event): Promise<void> { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return; this.isValidatingCsv = true; this.csvMessage = ''; try { const result = await this.purchaserAdmin.validateCsv(await file.text()); this.validations = new Map(result.results.filter(item => item.id && item.registrationStatus !== 'file_added').map(item => [item.id!, item])); this.csvOnly = []; this.purchasers = await this.purchaserAdmin.listLifeupPurchasers(); this.csvMessage = `${result.csvCount}건 대조 완료`; } catch (error) { this.csvMessage = error instanceof Error ? error.message : 'CSV 대조에 실패했습니다.'; } finally { this.isValidatingCsv = false; } }
    async syncImweb(): Promise<void> { this.isSyncingImweb = true; this.imwebSyncMessage = ''; try { const result = await this.purchaserAdmin.syncImwebPurchasers(); this.purchasers = await this.purchaserAdmin.listLifeupPurchasers(); this.imwebSyncMessage = `아임웹 어제 00시부터 조회 완료: ${result.imported}건 등록·갱신, ${result.skipped}건 제외`; } catch (error) { this.imwebSyncMessage = error instanceof Error ? error.message : '아임웹 구매자 정보를 갱신하지 못했습니다.'; } finally { this.isSyncingImweb = false; } }
    async createManualPurchase(): Promise<void> { if (this.manualBusy) return; this.manualBusy = true; this.manualMessage = ''; this.manualError = ''; try { const purchaser = await this.purchaserAdmin.createManualLifeupPurchase({ ...this.manualPurchase, purchasedAt: new Date(this.manualPurchase.purchasedAt).toISOString() }); this.purchasers = [purchaser, ...this.purchasers]; this.manualMessage = '수기 주문을 등록했습니다. 구매자는 기존과 동일하게 이메일 인증 로그인할 수 있습니다.'; this.manualPurchase = { name: '', email: '', phone: '', product: 'standard', amount: 0, purchasedAt: this.localDateTime() }; } catch (error) { this.manualError = error instanceof Error ? error.message : '수기 주문 등록에 실패했습니다.'; } finally { this.manualBusy = false; } }
    private localDateTime(): string { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
    private timestamp(p: LifeupPurchaser): number { const m = String(p.purchasedAt || '').match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/); if (!m) return 0; return Date.UTC(Number(m[1]) < 100 ? 2000 + Number(m[1]) : Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)); }
}
