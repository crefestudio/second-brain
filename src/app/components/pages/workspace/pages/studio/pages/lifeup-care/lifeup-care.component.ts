import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../../../services/auth.service';
import { CareMessage, CareRequest, CareRequestService } from '../../../../../../../services/care-request.service';

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

    openRequestForm(type: string): void { this.selectedType = type; this.requestTitle = ''; this.requestContent = ''; this.error = ''; }
    closeModal(): void { if (this.isSubmitting) return; this.selectedType = ''; this.selectedRequest = null; this.messageContent = ''; this.error = ''; }
    
    async loadRequests(): Promise<void> { 
        const result = await this.careRequests.list(this.adminView);
        this.requests = result.requests; 
        this.isAdmin = result.isAdmin; 
    }
    async submitRequest(): Promise<void> {
        if (!this.requestTitle.trim() || !this.requestContent.trim()) { this.error = '제목과 내용을 입력해주세요.'; return; }
        this.isSubmitting = true;
        try { await this.careRequests.create(this.selectedType, this.requestTitle.trim(), this.requestContent.trim()); this.selectedType = ''; await this.loadRequests(); }
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
        try { await this.careRequests.send(this.selectedRequest.id, this.messageContent.trim()); this.messageContent = ''; await this.openRequest(this.selectedRequest); await this.loadRequests(); }
        catch (error: any) { this.error = error.message || '메시지 전송에 실패했습니다.'; } finally { this.isSubmitting = false; }
    }
}
