import { _log } from '../../../../../lib/cf-common/cf-common';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

import { UserService } from '../../../../../services/user.service';
import { AuthService } from '../../../../../services/auth.service';



@Component({
    selector: 'app-event-log',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './event-log.component.html',
    styleUrls: ['./event-log.component.css']
})
export class EventLogComponent {
    logs: any[] = [];

    memberUid: string = '';
    userId: string = '';

    hasMore = true;
    isLoading = false;

    errorMessage = '';
    warnMessage = '';

    lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

    startDate = '';
    endDate = '';

    agents = [
        {
            id: 'secondbrain',
            name: '세컨드브레인 노트 키워드 추출'
        },
        {
            id: 'kakao-capture',
            name: '카카오톡 수집'
        }
    ];

    selectedAgentId = '';

    selectedLog: any = null;

    constructor(
        private authService: AuthService,
        private route: ActivatedRoute
    ) {
    }


    async ngOnInit() {
        await this.updateSession();
        this.selectedAgentId = this.route.snapshot.paramMap.get('agentId') ?? '';
        await this.loadLogs();
    }

    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();

        if (!this.userId) {
            console.error('워크스페이스 로그인에 실패하였습니다.');
            this.errorMessage = '워크스페이스 로그인에 실패하였습니다.';
            return;
        }
    }

    onClickRefreahBtn() {
        this.logs = [];
        this.loadLogs();
    }

    async loadLogs() {
        if (this.isLoading || !this.hasMore) return;
        this.isLoading = true;

        try {

            const start =
                this.startDate
                    ? new Date(`${this.startDate}T00:00:00`)
                    : null;

            const end =
                this.endDate
                    ? new Date(`${this.endDate}T23:59:59.999`)
                    : null;

            const result = await UserService.getUserEvents(
                this.userId,
                this.selectedAgentId,
                this.lastDoc,
                20,
                start,
                end
            );

            _log('loadLogs result =>', result);

            this.logs.push(...result.events);

            this.lastDoc = result.lastDoc;
            this.hasMore = result.hasMore;
        }
        finally {
            this.isLoading = false;
        }
    }
    // async loadLogs() {

    //     this.logs = [
    //         {
    //             agentId: 'secondbrain',
    //             eventTitle:
    //                 '<span style="color:#7fb7ff">B.현재 best</span> 노트 키워드 추출 진행',
    //             status: 'running',
    //             updatedAt: new Date('2026-06-28T20:35:12')
    //         },
    //         {
    //             agentId: 'secondbrain',
    //             eventTitle:
    //                 '<span style="color:#22c55e">완료</span> 노트 키워드 12개 생성',
    //             status: 'completed',
    //             updatedAt: new Date('2026-06-28T20:33:01')
    //         },
    //         {
    //             agentId: 'kakao-capture',
    //             eventTitle:
    //                 '<span style="color:#f59e0b">수집</span> 카카오톡 메모 저장',
    //             status: 'running',
    //             updatedAt: new Date('2026-06-28T19:58:43')
    //         },
    //         {
    //             agentId: 'kakao-capture',
    //             eventTitle:
    //                 '<span style="color:#ef4444">실패</span> 노션 페이지 생성 실패',
    //             status: 'error',
    //             updatedAt: new Date('2026-06-28T19:51:12')
    //         },
    //         {
    //             agentId: 'secondbrain',
    //             eventTitle:
    //                 '노트 키워드 추출 대기',
    //             status: 'waiting',
    //             updatedAt: new Date('2026-06-28T19:32:18')
    //         },
    //         {
    //             agentId: 'kakao-capture',
    //             eventTitle:
    //                 '카카오톡 메시지 수신',
    //             status: 'running',
    //             updatedAt: new Date('2026-06-28T19:21:07')
    //         },
    //         {
    //             agentId: 'secondbrain',
    //             eventTitle:
    //                 '<span style="color:#7fb7ff">회의록</span> 키워드 분석 완료',
    //             status: 'completed',
    //             updatedAt: new Date('2026-06-28T18:55:11')
    //         },
    //         {
    //             agentId: 'kakao-capture',
    //             eventTitle:
    //                 '<span style="color:#f59e0b">할일</span> DB 저장 진행',
    //             status: 'running',
    //             updatedAt: new Date('2026-06-28T18:31:22')
    //         },
    //         {
    //             agentId: 'secondbrain',
    //             eventTitle:
    //                 '독서 노트 키워드 추출',
    //             status: 'completed',
    //             updatedAt: new Date('2026-06-28T18:02:09')
    //         },
    //         {
    //             agentId: 'kakao-capture',
    //             eventTitle:
    //                 '카카오톡 수집 이벤트 처리',
    //             status: 'completed',
    //             updatedAt: new Date('2026-06-28T17:43:51')
    //         }
    //     ];

    //     this.hasMore = true;
    // }

    async loadMore() {
        await this.loadLogs();
    }

    async search() {
        this.logs = [];
        this.lastDoc = null;
        this.hasMore = true;

        await this.loadLogs();
    }

    readonly agentNames: Record<string, string> = {
        'secondbrain': '세컨드브레인 노트 키워드 추출',
        'kakao-capture': '카카오톡 수집'
    };

    getAgentName(agentId: string): string {
        return this.agentNames[agentId] ?? agentId;
    }

    getAgentClass(agentId: string): string {
        switch (agentId) {
            case 'secondbrain':
                return 'agent-secondbrain';
            case 'kakao-capture':
                return 'agent-kakao';
            default:
                return 'agent-default';
        }
    }

    async selectAgent(agentId: string) {

        this.selectedAgentId = agentId;

        this.logs = [];
        this.lastDoc = null;
        this.hasMore = true;

        await this.loadLogs();
    }

    toggleLog(log: any) {
        this.selectedLog =
            this.selectedLog === log ? null : log;
    }

    getDescriptionLines(description: string) {
        return description
            .split('\n')
            .filter(v => v.trim())
            .map(v => {
                const idx = v.indexOf(':');

                return {
                    key: idx >= 0 ? v.substring(0, idx + 1) : '',
                    value: idx >= 0 ? v.substring(idx + 1).trim() : v
                };
            });
    }
}