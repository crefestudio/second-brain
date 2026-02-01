import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { _log } from '../../../lib/cf-common/cf-common';

@Component({
    selector: 'app-oauth-success',
    standalone: true,
    imports: [
        CommonModule 
    ],
    templateUrl: './secondbrain.oauth-success.component.html',
    styleUrls: ['./secondbrain.oauth-success.component.css'],
})
export class SecondBrainOauthSuccessComponent implements OnInit {
    state = 'ready';
    workspaceName: string | null = null;
    botId: string | null = null;

    constructor( private route: ActivatedRoute, private userService: UserService) { 

    }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            const userId = params.get('userId');
            _log('OAuth callback userId =>', userId);

            if (!userId) return;

            this.loadSecondBrainIntegrationInfo(userId);
        });
    }

    async loadSecondBrainIntegrationInfo(userId: string) {
        const data = await UserService.getSecondBrainIntegration(userId);
        _log('loadSecondBrainIntegrationInfo data =>', data);

        if (!data) {
            this.state = 'fail';
            return;
        }

        this.state = 'success';
        this.botId = data.botId ?? null;    // 보안상 botId를 connectKey로 저장한다. 
        this.workspaceName = data.workspaceName ?? null;
    }
   
    // goHome() {
    //     window.location.href = '/';
    // }

    // copyKey() {
    //     if (!this.botId) return;
    //     navigator.clipboard.writeText(this.botId);
    // }
}
