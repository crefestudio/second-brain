import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../../../../services/auth.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';
import { ToastService } from '../../../../../../../services/toast.service';
import { UserService } from '../../../../../../../services/user.service';
import { NACommonService } from '../../../../../../../services/common.service';

@Component({
    selector: 'app-lifeup-migration',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './lifeup-migration.component.html',
    styleUrl: './lifeup-migration.component.scss'
})
export class LifeupMigrationComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    isMigrationConnected: boolean = false;

    currentStep = 0;

    // notion tempalte
    isOpenNotionConnectWindow: boolean = false; // 연결창 띄움 여부

    steps = [
        { title: '백업 • 설치', description: '새 버전 설치 및 기존 버전 백업' },
        { title: '연결', description: '데이터 이전 권한 연결' },
        { title: '사전 점검', description: '데이터 이전 가능 여부 확인' },
        { title: '데이터 이전', description: '1.3 → 1.5 데이터 이전' },
        { title: '결과 확인', description: '이전 결과 및 새 버전 확인' },
        { title: '완료', description: '업데이트 완료' }
    ];

    constructor(private authService: AuthService,
        private userService: UserService,
        private toastService: ToastService,
    ) {
    }

    async ngOnInit() {
        try {
            await this.initData();
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();
    }

    async updateSession() {
        await this.authService.updateSession();

        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.isMigrationConnected = false;

        if (this.userId) {
            this.isMigrationConnected = await this.userService.getMigrationConnectionStatus(this.userId);
        }

        _log(
            'updateSession memberUid, userId, isMigrationConnected =>',
            this.memberUid,
            this.userId,
            this.isMigrationConnected
        );
    }

    nextStep(backupChecked?: HTMLInputElement) {
        if (this.currentStep === 0 && !backupChecked?.checked) {
            ToastService.warning('백업 완료 여부를 확인해주세요.');
            return;
        }

        if (this.currentStep === 0 && this.isMigrationConnected) {
            this.currentStep = 2;
            return;
        }

        this.currentStep++;
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
        }
    }

    goToStep(index: number) {
        if (index <= this.currentStep) {
            this.currentStep = index;
        }
    }

    getStepStatus(index: number): string {
        if (index < this.currentStep) {
            return 'completed';
        }

        if (index === this.currentStep) {
            return 'active';
        }

        return 'waiting';
    }

    ///////////////////////////////////////////////////////////////
    //
    // notion tempate 연결

    onClickConnectTemplate() {
        this.isOpenNotionConnectWindow = true;
        this.userService.startNotionMigrationConnectWatcher(this.userId);
        this.openNotionConnectWindow();
    }

    onClickCancelConnectTemplateBtn() {
        this.isOpenNotionConnectWindow = false;
        this.userService.stopNotionMigrationConnectWatcher();
    }

    async openNotionConnectWindow() {
        _log('connectTemplate userId =>', this.userId);
        if (!this.userId) { return; }

        const encryptedUserId = await NACommonService.encrypt(this.userId); // 암호화해서 userId를 넘긴다.
        const baseUrl = window.location.origin;
        const serviceName = 'notion-migration-auth';
        const setupPath = 'connect';
        const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;
        window.open(url, '_blank');
        return;
    }

    onComplateNotionTemplateConnect() {
        this.isOpenNotionConnectWindow = false;
        ToastService.show(
            '노션 템플릿 연결이 완료되었습니다.'
        );
        this.updateSession();
    }

    async onClickDisconnectNotionTemplate() {
        const result = await this.userService.disconnectNotionTemplate(this.userId);
        this.updateSession();

        if (result) {
            ToastService.show(
                '노션 템플릿 연결을 해제하였습니다.'
            );

            // this.notionAccessToken = '';
        } else {
            ToastService.error(
                '노션 템플릿 연결 해제에 실패하였습니다.'
            );
        }
    }

    startCheckProcess() {

    }

}