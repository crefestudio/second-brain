import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { _log } from '../../../lib/cf-common/cf-common';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';


@Component({
    selector: 'app-oauth-fail',
    standalone: true,
    imports: [
        CommonModule 
    ],
    templateUrl: './secondbrain.oauth-fail.component.html',
    styleUrls: ['./secondbrain.oauth-fail.component.css'],
})
export class SecondBrainOauthFailComponent implements OnInit {
    state = 'ready';
    workspaceName: string | null = null;
    botId: string | null = null;
    private config = inject<AppConfig>(APP_CONFIG);
    userId: string | null = null;

    constructor( private route: ActivatedRoute, private userService: UserService) { 

    }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            const userId = params.get('userId');
            _log('OAuth callback userId =>', userId);

            if (!userId) return;
            this.userId = userId;
            //this.loadSecondBrainIntegrationInfo(userId);
        });
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
