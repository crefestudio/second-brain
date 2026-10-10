import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';
import { CustomerAdminService, LifeupCustomer } from '../../../../../services/customer-admin.service';

type MemberFilter = 'all' | 'standard' | 'premium' | 'scrapbook' | 'none';
type NotifyFilter = 'all' | 'yes' | 'no' | 'blocked';
type MembershipFilter = 'all' | 'premium' | 'standard' | 'scrapbook' | 'none';

@Component({ selector: 'app-customer-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './customer-admin.component.html', styleUrl: './customer-admin.component.scss' })
export class CustomerAdminComponent implements OnInit, OnDestroy {
    sort = 'purchasedAt'; direction = 'desc'; filteredCount = 0; listError = ''; isRefreshing = false;
    private requestVersion = 0;
    private controller?: AbortController;
    private searchTimer?: ReturnType<typeof setTimeout>;
    private mailRequest: { signature: string; id: string } | null = null;
    isLoading = true; isImporting = false; isSendingMail = false; isLoadingMore = false; hasMore = false; errorMessage = ''; csvMessage = ''; mailMessage = '';
    private nextCursor: string | null = null;
    customers: LifeupCustomer[] = []; totalCustomerCount = 0; selectedCustomer: LifeupCustomer | null = null; selectedIds = new Set<string>();
    search = ''; memberFilter: MemberFilter = 'all'; membershipFilter: MembershipFilter = 'all'; notifyFilter: NotifyFilter = 'all'; mailTemplate: '' | 'standard-purchaser-welcome' | 'standard-purchaser-update' | 'premium-purchaser-welcome' | 'premium-purchaser-update' | 'scrapbook-purchaser-welcome' = '';
    constructor(private readonly care: CareRequestService, private readonly customerAdmin: CustomerAdminService) {}

    async ngOnInit(): Promise<void> {
        try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); await this.load(); }
        catch (error) { this.errorMessage = error instanceof Error ? error.message : '고객 목록을 불러오지 못했습니다.'; }
        finally { this.isLoading = false; }
    }

    get filteredCustomers(): LifeupCustomer[] {
        return this.customers;
    }

    ngOnDestroy(): void { clearTimeout(this.searchTimer); this.controller?.abort(); this.requestVersion++; }
    criteriaChanged(debounce = false): void {
        clearTimeout(this.searchTimer);
        this.controller?.abort();
        this.requestVersion++;
        this.customers = []; this.selectedIds.clear(); this.selectedCustomer = null;
        this.nextCursor = null; this.hasMore = false; this.filteredCount = 0;
        this.isLoadingMore = false; this.isRefreshing = true; this.listError = '';
        this.searchTimer = setTimeout(() => void this.refresh(), debounce ? 400 : 0);
    }
    async refresh(): Promise<void> {
        try { await this.load(); }
        catch (error) { this.listError = error instanceof Error ? error.message : '고객 목록 조회에 실패했습니다.'; }
    }

    get allVisibleSelected(): boolean { return this.filteredCustomers.length > 0 && this.filteredCustomers.every(customer => this.selectedIds.has(customer.id)); }
    get selectedCustomers(): LifeupCustomer[] { return this.customers.filter(customer => this.selectedIds.has(customer.id)); }
    get selectedNonConsentingCount(): number { return this.selectedCustomers.filter(customer => customer.notificationConsent !== '예' && customer.notificationConsent !== '차단').length; }
    get selectedBlockedCount(): number { return this.selectedCustomers.filter(customer => customer.notificationConsent === '차단').length; }
    toggleAll(): void { const selected = this.allVisibleSelected; for (const customer of this.filteredCustomers) selected ? this.selectedIds.delete(customer.id) : this.selectedIds.add(customer.id); }
    toggle(customer: LifeupCustomer): void { this.selectedIds.has(customer.id) ? this.selectedIds.delete(customer.id) : this.selectedIds.add(customer.id); }
    toggleDetail(customer: LifeupCustomer): void { this.selectedCustomer = this.selectedCustomer?.id === customer.id ? null : customer; }
    serviceLabel(customer: LifeupCustomer): string { return customer.memberType === 'premium' ? '라이프업 프리미엄' : customer.memberType === 'standard' ? '라이프업' : customer.memberType === 'scrapbook' ? '라이프업 스크랩북' : '비구매자'; }
    membershipLabel(customer: LifeupCustomer): string { return customer.membership === 'premium' ? '라이프업 프리미엄 회원' : customer.membership === 'standard' ? '라이프업 회원' : customer.membership === 'scrapbook' ? '라이프업 스크랩북 회원' : '비회원'; }
    detailEntries(customer: LifeupCustomer): Array<{ key: string; value: string }> { return Object.entries(customer).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '') })); }

    async sendSelectedMail(): Promise<void> {
        if (!this.selectedIds.size || !this.mailTemplate || this.isSendingMail) return;
        this.isSendingMail = true; this.mailMessage = '';
        // `customers` is already in the table's current server-side sort order.
        const customerIds = this.selectedCustomers.map(customer => customer.id);
        const signature = JSON.stringify([customerIds, this.mailTemplate]);
        if (this.mailRequest?.signature !== signature) this.mailRequest = { signature, id: crypto.randomUUID() };
        const requestId = this.mailRequest.id;
        try {
            let result = await this.customerAdmin.sendSelectedMail(customerIds, this.mailTemplate, false, requestId);
            if (result.requiresConsentConfirmation) {
                const warning = `알림 미동의 또는 미응답 이메일 ${result.nonConsentingCount || 0}건이 포함되어 있습니다.\n차단 이메일 ${result.blockedCount || 0}건은 발송하지 않습니다.\n그래도 선택한 메일을 발송할까요?`;
                if (!window.confirm(warning)) { this.mailMessage = '메일 발송을 취소했습니다.'; return; }
                result = await this.customerAdmin.sendSelectedMail(customerIds, this.mailTemplate, true, requestId);
            }
            this.mailMessage = `${result.queuedCount || 0}건을 발송 대기열에 등록했습니다. 메일 발송 관리에서 상태를 확인하세요.${result.failedCount ? ` ${result.failedCount}건은 등록 실패했습니다. 같은 선택으로 다시 시도하면 실패 건만 추가됩니다.` : ''}${result.blockedCount ? ` 수신 차단 ${result.blockedCount}건은 제외했습니다.` : ''}`;
            if (!result.failedCount) this.selectedIds.clear();
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

    async loadMore(): Promise<void> {
        if (this.isLoadingMore || this.isRefreshing || !this.nextCursor) return;
        this.isLoadingMore = true;
        try { await this.load(true); }
        catch (error) { this.listError = error instanceof Error ? error.message : '고객 목록을 더 불러오지 못했습니다.'; }
    }
    private async load(more = false): Promise<void> {
        const version = ++this.requestVersion;
        this.controller?.abort(); this.controller = new AbortController(); this.listError = '';
        if (!more) { this.isRefreshing = true; this.selectedIds.clear(); this.selectedCustomer = null; }
        try {
            const page = await this.customerAdmin.list({ search: this.search, memberFilter: this.memberFilter,
                membershipFilter: this.membershipFilter, notifyFilter: this.notifyFilter, sort: this.sort, direction: this.direction },
                more ? this.nextCursor || undefined : undefined, this.controller.signal);
            if (version !== this.requestVersion) return;
            const rows = more ? [...this.customers, ...page.customers] : page.customers;
            this.customers = [...new Map(rows.map(row => [row.id, row])).values()];
            this.totalCustomerCount = page.totalCount; this.filteredCount = page.filteredCount;
            this.nextCursor = page.nextCursor; this.hasMore = Boolean(page.nextCursor);
        } catch (error) { if (version === this.requestVersion) throw error; }
        finally { if (version === this.requestVersion) { this.isRefreshing = false; this.isLoadingMore = false; } }
    }
}
