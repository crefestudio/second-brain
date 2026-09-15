import { _log } from '../../../../lib/cf-common/cf-common';
import { UserService } from '../../../../services/user.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-migration-oauth-success',
    standalone: true,
    imports: [
        CommonModule
    ],
    templateUrl: './notion-migration-oauth-success.component.html',
    styleUrls: ['./notion-migration-oauth-success.component.css'],
})
export class NotionMigrationOauthSuccessComponent implements OnInit {
    constructor(private route: ActivatedRoute, private userService: UserService) {

    }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            const userId = params.get('userId');
            _log('OAuth callback userId =>', userId);

            if (!userId) return;
        });
    }

}
