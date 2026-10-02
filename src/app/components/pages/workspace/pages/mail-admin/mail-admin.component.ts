import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MailAdminService, MailQueueItem } from '../../../../../services/mail-admin.service';
import { CareRequestService } from '../../../../../services/care-request.service';

@Component({ selector: 'app-mail-admin', standalone: true, imports: [CommonModule],
    templateUrl: './mail-admin.component.html', styleUrl: './mail-admin.component.scss' })
export class MailAdminComponent implements OnInit {
    private api = inject(MailAdminService);
    private care = inject(CareRequestService);
    items: MailQueueItem[] = []; usage: Record<string, number> = {}; error = ''; loading = false; hasMore = false; allowed = false; cancellingId = '';
    priorities = [{ id: 'high', label: '우선 · 인증·구매·서비스 알림' }, { id: 'normal', label: '보통 · 수동 발송', limit: 70 }];
    async ngOnInit() {
        try {
            this.allowed = (await this.care.access()).isAdmin;
            if (!this.allowed) throw new Error('관리자 계정으로 로그인해주세요.');
            await this.load();
        } catch (error) { this.error = error instanceof Error ? error.message : '목록 조회 실패'; }
    }
    async load(more = false) {
        if (this.loading || !this.allowed) return;
        this.loading = true; this.error = '';
        try {
            const last = more ? this.items[this.items.length - 1] : undefined;
            const page = await this.api.list(last?.createdAt, last?.id);
            this.items = more ? [...this.items, ...page.items] : page.items; this.usage = page.usage; this.hasMore = page.items.length === 100;
        } catch (error) { this.error = error instanceof Error ? error.message : '목록 조회 실패'; }
        finally { this.loading = false; }
    }
    priority(value: string) { return ({ critical: '우선', high: '우선', normal: '보통' } as Record<string, string>)[value] || value; }
    status(value: string) { return ({ pending: '발송 대기', sending: '발송 중', sent: '발송됨', failed: '발송 실패', expired: '인증 만료', cancelled: '발송 취소', review: '확인 필요' } as Record<string, string>)[value] || value; }
    async cancel(item: MailQueueItem): Promise<void> {
        if (item.status !== 'pending' || this.cancellingId) return;
        this.cancellingId = item.id; this.error = '';
        try { await this.api.cancel(item.id); await this.load(); }
        catch (error) { this.error = error instanceof Error ? error.message : '메일 발송 취소에 실패했습니다.'; }
        finally { this.cancellingId = ''; }
    }
}
