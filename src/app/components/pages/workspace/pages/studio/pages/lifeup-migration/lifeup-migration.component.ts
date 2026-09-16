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

    // #migraton
    migrationCheckResults: any[] = [];
    migrationCheckTotalCount = 0;
    migrationCheckStatus = 'READY';
    migrationCheckComplete = false;
    migrationCheckSuccess = false;


    async ngOnInit() {

        this.userService.verificationResult$.subscribe(result => {
            this.migrationCheckResults.push(result);
        });

        this.userService.verificationStatus$.subscribe(status => {
            this.migrationCheckTotalCount = status.totalCount || 0;

            if (status.status !== 'complete') { return; }

            this.migrationCheckComplete = true;
            this.migrationCheckSuccess = status.success === true;
            this.migrationCheckStatus = this.migrationCheckSuccess ? 'READY' : 'ERROR';

            this.userService.stopVerificationWatcher();
        });

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

    async startCheckProcess() {
        this.userService.stopVerificationWatcher();

        this.migrationCheckStatus = 'CHECKING';
        this.migrationCheckComplete = false;
        this.migrationCheckResults = [];
        this.migrationCheckTotalCount = 0;
        this.migrationCheckSuccess = false;

        const result: any = await this.userService.checkLifeUpMigration(this.userId);

        if (!result?.success || !result.runId) {
            this.migrationCheckStatus = 'ERROR';
            return;
        }

        this.userService.startVerificationWatcher(this.userId, result.runId);
    }

    getMigrationCheckMessage(item: any): string {
        if (item.type === 'removed') {
            return `${item.dbName} DB는 새 버전에서 더 이상 사용하지 않아 이전하지 않습니다.`;
        }

        if (item.type === 'not-found-old') {
            return `${item.dbName} DB를 1.3 버전에서 찾을 수 없습니다.`;
        }

        if (item.type === 'not-found-new') {
            return `${item.dbName} DB를 1.5 버전에서 찾을 수 없습니다. 1.5 버전 설치를 확인해주세요.`;
        }

        if (item.type === 'schema') {
            const properties = item.onlyOld?.join(', ') || '';
            return `${item.dbName} DB에 1.5 버전에서 없는 프로퍼티가 있습니다: ${properties} `;
        }

        if (item.type === 'none') {
            return `${item.dbName} DB는 이전 대상이 아닙니다.`;
        }

        if (item.type === 'migration') {
            if (item.count > 0) {
                return `${item.dbName} DB의 ${item.count}개 데이터를 새 버전으로 이전합니다.`;
            }

            return `${item.dbName} DB에 이전할 데이터가 없습니다.`;
        }

        return `${item.dbName} DB 확인 중 오류가 발생했습니다.`;
    }

    // const result = await this.userService.analyzeLifeUpMigrationSchema(this.userId);

    // if (result?.success) {
    //     console.log('마이그레이션 구조 점검 완료');
    // }


}