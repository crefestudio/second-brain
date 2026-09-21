import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../../services/auth.service';
import { CareAttachment, CareMessage, CareRequest, CareRequestService } from '../../../../../../services/care-request.service';
import { ToastService } from '../../../../../../services/toast.service';

@Component({
    selector: 'app-lifeup-care',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule],
    templateUrl: './lifeup-care.component.html',
    styleUrl: './lifeup-care.component.scss'
})
export class LifeupCareComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';
    requests: CareRequest[] = [];
    isAdmin = false;
    selectedType = '';
    requestTitle = '';
    requestContent = '';
    selectedRequest: CareRequest | null = null;
    messages: CareMessage[] = [];
    messageContent = '';
    isSubmitting = false;
    error = '';
    adminView = false;
    requestLoading = false;
    search = '';
    premiumNotice = false;
    files: File[] = [];
    get requestHint(): string {
        return ({ '개선 의견': '개선이 필요한 점과 아이디어를 알려주세요.', '오류 신고': '문제가 발생한 상황과 재현 방법을 알려주세요.', '사용 문의': '궁금한 기능과 사용 중인 상황을 알려주세요.', '라이프업 활용 상담': '어떤 목적으로 라이프업을 활용하고 싶으신가요?', '템플릿 업데이트 요청': '현재 버전과 원하는 변경 내용을 알려주세요.' } as Record<string, string>)[this.selectedType] || '';
    }
    chooseFiles(event: Event): void {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) {
            this.error = '최대 5개, 합계 20MB까지 첨부할 수 있습니다.'; input.value = ''; this.files = []; return;
        }
        this.files = files; this.error = '';
    }
    async downloadAttachment(attachment: CareAttachment): Promise<void> {
        if (!this.selectedRequest) return;
        try { await this.careRequests.download(this.selectedRequest.id, attachment); }
        catch { this.error = '첨부파일 다운로드에 실패했습니다.'; }
    }
    get visibleRequests(): CareRequest[] {
        const term = this.search.trim().toLowerCase();
        return this.requests.filter(item => `${item.title} ${item.ownerEmail} ${item.type} ${item.status}`.toLowerCase().includes(term));
    }

    constructor(private authService: AuthService, private careRequests: CareRequestService, private route: ActivatedRoute) {
        this.adminView = route.snapshot.data['adminView'] === true;
    }

    async ngOnInit() {
        try {
            await this.initData();
            const requestId = this.route.snapshot.queryParamMap.get('requestId');
            if (requestId) await this.openRequest({ id: requestId });
        } catch (error: any) {
            this.error = error.message || '요청 정보를 불러오지 못했습니다.';
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();
    }

    async updateSession() {
        if (this.adminView) {
            this.isAdmin = (await this.careRequests.access()).isAdmin;
            if (!this.isAdmin) throw new Error('관리자 계정으로 로그인해주세요.');
            await this.loadRequests();
            return;
        }
        await this.authService.updateSession();

        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();
        if (this.userId) await this.loadRequests();

    }

    async openRequestForm(type: string): Promise<void> {
        this.error = '';
        if (type === '템플릿 업데이트 요청') {
            try {
                if (!(await this.careRequests.access()).isPremium) { this.premiumNotice = true; return; }
            } catch { this.error = '회원 등급을 확인하지 못했습니다. 다시 시도해주세요.'; return; }
        }
        this.selectedType = type; this.requestTitle = ''; this.requestContent = ''; this.files = [];
    }
    showUnavailableServiceNotice(): void {
        ToastService.warning('아직 기능 준비 중입니다. 사용 문의 또는 오류 신고로 접수해주세요.');
    }
    closeModal(): void { if (this.isSubmitting) return; this.selectedType = ''; this.selectedRequest = null; this.messageContent = ''; this.error = ''; }
    
    async loadRequests(): Promise<void> { 
        const result = await this.careRequests.list(this.adminView);
        this.requests = result.requests; 
        this.isAdmin = result.isAdmin; 
    }
    async submitRequest(): Promise<void> {
        if (!this.requestTitle.trim() || !this.requestContent.trim()) { this.error = '제목과 내용을 입력해주세요.'; return; }
        this.isSubmitting = true;
        try { await this.careRequests.create(this.selectedType, this.requestTitle.trim(), this.requestContent.trim(), this.files); this.selectedType = ''; this.files = []; await this.loadRequests(); }
        catch (error: any) { this.error = error.message || '접수에 실패했습니다.'; } finally { this.isSubmitting = false; }
    }
    async openRequest(request: { id: string }): Promise<void> {
        this.error = '';
        this.requestLoading = true;
        try {
            const result = await this.careRequests.get(request.id);
            this.selectedRequest = result.request;
            this.messages = result.messages;
            this.isAdmin = result.isAdmin;
        } catch (error: any) { this.error = error.message || '대화를 불러오지 못했습니다.'; }
        finally { this.requestLoading = false; }
    }
    async sendMessage(): Promise<void> {
        if (!this.selectedRequest || !this.messageContent.trim()) return;
        this.isSubmitting = true;
        try { await this.careRequests.send(this.selectedRequest.id, this.messageContent.trim(), this.adminView); this.messageContent = ''; await this.openRequest(this.selectedRequest); await this.loadRequests(); }
        catch (error: any) { this.error = error.message || '메시지 전송에 실패했습니다.'; } finally { this.isSubmitting = false; }
    }
}
