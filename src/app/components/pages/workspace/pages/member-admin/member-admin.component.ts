import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareRequestService } from '../../../../../services/care-request.service';
import { AppMember, MemberAdminService } from '../../../../../services/member-admin.service';

@Component({ selector: 'app-member-admin', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './member-admin.component.html', styleUrl: './member-admin.component.scss' })
export class MemberAdminComponent implements OnInit {
    isLoading = true; errorMessage = ''; members: AppMember[] = []; search = ''; consentFilter: 'all' | 'yes' | 'no' = 'all';
    constructor(private readonly care: CareRequestService, private readonly memberAdmin: MemberAdminService) {}
    async ngOnInit(): Promise<void> { try { if (!(await this.care.access()).isAdmin) throw new Error('관리자 계정으로 로그인해주세요.'); this.members = await this.memberAdmin.list(); } catch (error) { this.errorMessage = error instanceof Error ? error.message : '회원 목록을 불러오지 못했습니다.'; } finally { this.isLoading = false; } }
    get filteredMembers(): AppMember[] { const term = this.search.trim().toLowerCase(); return this.members.filter(member => (!term || [member.profileName, member.email, member.phoneNumber, ...member.workspaceIds].join(' ').toLowerCase().includes(term)) && (this.consentFilter === 'all' || member.marketingConsent === (this.consentFilter === 'yes'))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }
    formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ko-KR'); }
}
