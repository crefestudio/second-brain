import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';
import { CustomerAdminService, LifeupCustomer } from '../../../../../services/customer-admin.service';

type MemberFilter = 'all' | 'standard' | 'premium' | 'none';
type NotifyFilter = 'all' | 'yes' | 'no' | 'blocked';
type MembershipFilter = 'all' | 'premium' | 'standard' | 'none';

@Component({ selector: 'app-customer-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './customer-admin.component.html', styleUrl: './customer-admin.component.scss' })
export class CustomerAdminComponent implements OnInit {
    isLoading = true; isImporting = false; isSendingMail = false; errorMessage = ''; csvMessage = ''; mailMessage = '';
    customers: LifeupCustomer[] = []; selectedCustomer: LifeupCustomer | null = null; selectedIds = new Set<string>();
    search = ''; memberFilter: MemberFilter = 'all'; membershipFilter: MembershipFilter = 'all'; notifyFilter: NotifyFilter = 'all'; mailTemplate: 'standard-purchaser-welcome' | 'standard-purchaser-update' | 'premium-purchaser-welcome' = 'standard-purchaser-welcome';
    constructor(private readonly care: CareRequestService, private readonly customerAdmin: CustomerAdminService) {}

    async ngOnInit(): Promise<void> {
        try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); await this.load(); }
        catch (error) { this.errorMessage = error instanceof Error ? error.message : '고객 목록을 불러오지 못했습니다.'; }
        finally { this.isLoading = false; }
    }

    get filteredCustomers(): LifeupCustomer[] {
        const term = this.search.trim().toLowerCase();
        return this.customers.filter(customer => {
            const matchesSearch = !term || [customer.name, customer.phoneDisplay, customer.phone, ...(customer.emails || [])].join(' ').toLowerCase().includes(term);
            const matchesMember = this.memberFilter === 'all' || (this.memberFilter === 'none' ? !customer.memberType : customer.memberType === this.memberFilter);
            const matchesMembership = this.membershipFilter === 'all' || customer.membership === this.membershipFilter;
            const matchesNotify = this.notifyFilter === 'all' || (this.notifyFilter === 'yes' ? customer.notificationConsent === '예' : this.notifyFilter === 'blocked' ? customer.notificationConsent === '차단' : customer.notificationConsent === '아니오' || customer.notificationConsent === '미응답');
            return matchesSearch && matchesMember && matchesMembership && matchesNotify;
        }).sort((a, b) => this.timestamp(b.purchasedAt) - this.timestamp(a.purchasedAt));
    }

    get allVisibleSelected(): boolean { return this.filteredCustomers.length > 0 && this.filteredCustomers.every(customer => this.selectedIds.has(customer.id)); }
    get selectedCustomers(): LifeupCustomer[] { return this.customers.filter(customer => this.selectedIds.has(customer.id)); }
    get selectedNonConsentingCount(): number { return this.selectedCustomers.filter(customer => customer.notificationConsent !== '예' && customer.notificationConsent !== '차단').length; }
    get selectedBlockedCount(): number { return this.selectedCustomers.filter(customer => customer.notificationConsent === '차단').length; }
    toggleAll(): void { const selected = this.allVisibleSelected; for (const customer of this.filteredCustomers) selected ? this.selectedIds.delete(customer.id) : this.selectedIds.add(customer.id); }
    toggle(customer: LifeupCustomer): void { this.selectedIds.has(customer.id) ? this.selectedIds.delete(customer.id) : this.selectedIds.add(customer.id); }
    toggleDetail(customer: LifeupCustomer): void { this.selectedCustomer = this.selectedCustomer?.id === customer.id ? null : customer; }
    serviceLabel(customer: LifeupCustomer): string { return customer.memberType === 'premium' ? '라이프업 프리미엄' : customer.memberType === 'standard' ? '라이프업 일반' : '비구매자'; }
    membershipLabel(customer: LifeupCustomer): string { return customer.membership === 'premium' ? '프리미엄 회원' : customer.membership === 'standard' ? '일반 회원' : '비회원'; }
    detailEntries(customer: LifeupCustomer): Array<{ key: string; value: string }> { return Object.entries(customer).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '') })); }

    async sendSelectedMail(): Promise<void> {
        if (!this.selectedIds.size || this.isSendingMail) return;
        this.isSendingMail = true; this.mailMessage = '';
        try {
            let result = await this.customerAdmin.sendSelectedMail([...this.selectedIds], this.mailTemplate);
            if (result.requiresConsentConfirmation) {
                const warning = `알림 미동의 또는 미응답 이메일 ${result.nonConsentingCount || 0}건이 포함되어 있습니다.\n차단 이메일 ${result.blockedCount || 0}건은 발송하지 않습니다.\n그래도 기존 일반 구매자 메일을 발송할까요?`;
                if (!window.confirm(warning)) { this.mailMessage = '메일 발송을 취소했습니다.'; return; }
                result = await this.customerAdmin.sendSelectedMail([...this.selectedIds], this.mailTemplate, true);
            }
            this.mailMessage = `${result.sentCount || 0}건 발송했습니다.${result.failedCount ? ` ${result.failedCount}건은 실패했습니다.` : ''}${result.blockedCount ? ` 수신 차단 ${result.blockedCount}건은 제외했습니다.` : ''}`;
        } catch (error) { this.mailMessage = error instanceof Error ? error.message : '메일 발송에 실패했습니다.'; }
        finally { this.isSendingMail = false; }
    }

    async onCsvSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
        this.isImporting = true; this.csvMessage = '';
        try { const result = await this.customerAdmin.importCsv(await file.text()); await this.load(); this.csvMessage = `${result.csvCount}건을 ${result.customerCount}명의 고객으로 등록했습니다.${result.skippedRows ? ` 휴대폰 번호 없는 ${result.skippedRows}건은 제외했습니다.` : ''}`; }
        catch (error) { this.csvMessage = error instanceof Error ? error.message : 'CSV 등록에 실패했습니다.'; }
        finally { this.isImporting = false; }
    }

    private async load(): Promise<void> { this.customers = await this.customerAdmin.list(); }
    private timestamp(value: unknown): number { const match = String(value || '').match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/); return match ? Date.UTC(Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0)) : 0; }
}
