import { _log } from '../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../services/user.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-oauth-success',
    standalone: true,
    imports: [
        CommonModule 
    ],
    templateUrl: './notion-oauth-success.component.html',
    styleUrls: ['./notion-oauth-success.component.css'],
})
export class NotionOauthSuccessComponent implements OnInit {
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

}
