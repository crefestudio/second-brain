import { _log } from '../../../../lib/cf-common/cf-common';
import { NACommonService } from '../../../../services/common.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { APP_CONFIG, AppConfig } from '../../../../config/app-config.token';
import { NotionService } from '../../../../services/notion.service';
import { UserService } from '../../../../services/user.service';

@Component({
    selector: 'app-connect',
    standalone: true,
    templateUrl: './notion-connect.component.html',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./notion-connect.component.css']
})
export class NotionConnectComponent implements OnInit {
    state: string = ''; // notjoin, notconnected, connected
    private config = inject<AppConfig>(APP_CONFIG);
    activeTab: 'installed' | 'not-installed' = 'installed';

    userId: string = '';

    selectTab(tab: 'installed' | 'not-installed') {
        this.activeTab = tab;
    }

    constructor(private notionService: NotionService, private userService: UserService) {

    }

    ngOnInit() {
        this.connectProc();
    }

    async connectProc() {
        // URL에서 token 혹은 query param으로 전화번호 가져오기
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (!token) return;
        let userId = await NACommonService.decrypt(token);
        if (!userId) {
            _log('connectProc userId =>', userId);
            this.state = 'notjoin';
            return;
        }
        this.userId = userId;

        const data: any = await UserService.getSecondBrainIntegration(userId);
        _log('connectProc secondbrain userId, data =>', userId, data);

        if (!data) {
            this.state = 'notconnected';
            return;
        }

        if (data.accessToken && data.noteDatabaseId) {
            this.state = 'connected';
        } else {
            this.state = 'notconnected';
        }

        _log('loginProc state =>', this.state);
    }

    async connectNotion() {
        _log('connectNotion state, userId =>', this.state, this.userId);
        let userId = '';
        if (this.userId) {
            userId = this.userId;
        } else if (this.state == 'notjoin') {
            alert('오류 - 아직 계정이 만들어지지 않았습니다.');
        } else {
            alert('오류 - userId없음');
        }

        // 3. state를 query로 넘김
        window.location.href = `${this.config.functionsBaseUrl}/notionAuth?userId=${userId}`;
    }
}


