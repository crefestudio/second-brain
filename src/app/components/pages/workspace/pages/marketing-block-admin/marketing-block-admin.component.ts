import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CareRequestService } from '../../../../../services/care-request.service';
import { MarketingBlock, MarketingBlockAdminService } from '../../../../../services/marketing-block-admin.service';

@Component({ selector: 'app-marketing-block-admin', standalone: true, imports: [CommonModule], templateUrl: './marketing-block-admin.component.html', styleUrl: './marketing-block-admin.component.scss' })
export class MarketingBlockAdminComponent implements OnInit {
    isLoading = true; isLoadingMore = false; error = ''; blocks: MarketingBlock[] = []; totalCount = 0; hasMore = false;
    constructor(private readonly care: CareRequestService, private readonly marketingBlocks: MarketingBlockAdminService) {}
    async ngOnInit(): Promise<void> {
        try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); await this.load(); }
        catch (error) { this.error = error instanceof Error ? error.message : '수신 차단 목록을 불러오지 못했습니다.'; }
        finally { this.isLoading = false; }
    }
    async loadMore(): Promise<void> {
        if (this.isLoadingMore || !this.hasMore) return;
        this.isLoadingMore = true; this.error = '';
        try { await this.load(true); } catch (error) { this.error = error instanceof Error ? error.message : '수신 차단 목록을 더 불러오지 못했습니다.'; }
        finally { this.isLoadingMore = false; }
    }
    formatDate(value: number): string { return value ? new Date(value).toLocaleString('ko-KR') : '-'; }
    private async load(more = false): Promise<void> {
        const page = await this.marketingBlocks.list(more ? this.blocks[this.blocks.length - 1] : undefined);
        this.blocks = more ? [...this.blocks, ...page.blocks] : page.blocks; this.totalCount = page.totalCount; this.hasMore = page.hasMore;
    }
}
