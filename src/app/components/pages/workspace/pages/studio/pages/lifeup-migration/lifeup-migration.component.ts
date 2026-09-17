import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
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

    // #migration
    migrationCheckRunId = '';
    migrationCheckResults: any[] = [];
    migrationCheckTotalCount = 0;
    migrationCheckStatus = 'READY';
    migrationCheckComplete = false;
    migrationCheckSuccess = false;

    private forceStopTimer: any;
    forceStopAvailable = false;

    // notion template
    isOpenNotionConnectWindow: boolean = false;

    steps = [
        { title: '백업 • 설치', description: '새 버전 설치 및 기존 버전 백업' },
        { title: '연결', description: '데이터 이전 권한 연결' },
        { title: '사전 점검', description: '데이터 이전 가능 여부 확인' },
        { title: '데이터 이전', description: '1.3 → 1.5 데이터 이전' },
        { title: '결과 확인', description: '이전 결과 및 새 버전 확인' },
        { title: '완료', description: '업데이트 완료' }
    ];

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private route: ActivatedRoute,
        private toastService: ToastService
    ) { }

    async ngOnInit() {
        this.restoreStepFromHash();

        console.log('[Migration Check] restore step:', this.currentStep);

        this.userService.migrationCheckResult$.subscribe(result => {
            console.log('[Migration Check] watcher result:', result);
            this.mergeMigrationCheckResult(result);
        });

        this.userService.migrationCheckStatus$.subscribe(status => {
            console.log('[Migration Check] watcher status:', status);

            this.migrationCheckTotalCount = status.totalCount || 0;

            if (status.status !== 'complete') {
                this.migrationCheckStatus = 'CHECKING';
                return;
            }

            this.migrationCheckComplete = true;
            this.migrationCheckSuccess = status.success === true;
            this.migrationCheckStatus = this.migrationCheckSuccess ? 'READY' : 'ERROR';

            this.userService.stopMigrationCheckWatcher();

            this.clearForceStopTimer();
            this.forceStopAvailable = false;
        });

        try {
            await this.initData();
            console.log('[Migration Check] userId:', this.userId);

            await this.restoreMigrationCheck();
        } finally {
            this.isLoading = false;
        }
    }

    async restoreMigrationCheck() {
        if (!this.userId) {
            return;
        }

        const run = await this.userService.getMigrationCheckRun(this.userId);

        if (!run?.runId) {
            return;
        }

        this.migrationCheckRunId = run.runId;
        this.migrationCheckTotalCount = run.totalCount || 0;
        this.migrationCheckComplete = run.status === 'complete';
        this.migrationCheckSuccess = run.success === true;

        if (run.status === 'complete') {
            this.migrationCheckStatus = this.migrationCheckSuccess ? 'READY' : 'ERROR';
            this.forceStopAvailable = false;
        } else {
            this.migrationCheckStatus = 'CHECKING';
            this.startForceStopTimer();
        }

        const results = await this.userService.getMigrationCheckResults(
            this.userId,
            this.migrationCheckRunId
        );

        this.migrationCheckResults = results || [];

        if (run.status !== 'complete') {
            this.userService.startMigrationCheckWatcher(
                this.userId,
                this.migrationCheckRunId
            );
        }
    }

    restoreStepFromHash() {
        const fragment = this.route.snapshot.fragment;

        if (!fragment?.startsWith('step-')) {
            return;
        }

        const step = Number(fragment.replace('step-', ''));

        if (Number.isInteger(step) && step >= 0 && step < this.steps.length) {
            this.currentStep = step;
        }
    }

    updateStepHash() {
        const url = `${window.location.pathname}${window.location.search}#step-${this.currentStep}`;
        window.history.replaceState(null, '', url);
    }

    mergeMigrationCheckResult(result: any) {
        const index = this.migrationCheckResults.findIndex(
            item => item.id === result.id || item.dbName === result.dbName
        );

        if (index >= 0) {
            this.migrationCheckResults[index] = result;
        } else {
            this.migrationCheckResults.push(result);
        }

        this.migrationCheckResults.sort((a, b) => (a.order || 0) - (b.order || 0));
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

        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateStepHash();
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStepHash();
        }
    }

    goToStep(index: number) {
        if (index <= this.currentStep) {
            this.currentStep = index;
            this.updateStepHash();
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
    // notion template 연결

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

        if (!this.userId) {
            return;
        }

        const encryptedUserId = await NACommonService.encrypt(this.userId);
        const baseUrl = window.location.origin;
        const serviceName = 'notion-migration-auth';
        const setupPath = 'connect';
        const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;

        window.open(url, '_blank');
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
        } else {
            ToastService.error(
                '노션 템플릿 연결 해제에 실패하였습니다.'
            );
        }
    }

    ///////////////////////////////////////////////////////////////
    //
    // migration check

    async startCheckProcess() {
        this.userService.stopMigrationCheckWatcher();

        this.clearForceStopTimer();
        this.forceStopAvailable = false;

        this.migrationCheckRunId = '';
        this.migrationCheckStatus = 'CHECKING';
        this.migrationCheckComplete = false;
        this.migrationCheckResults = [];
        this.migrationCheckTotalCount = 0;
        this.migrationCheckSuccess = false;

        const result: any = await this.userService.checkLifeUpMigration(this.userId);

        console.log('[Migration Check] start result:', result);

        if (!result?.success || !result.runId) {
            this.migrationCheckStatus = 'ERROR';
            return;
        }

        this.migrationCheckRunId = result.runId;

        this.startForceStopTimer();

        console.log('[Migration Check] watcher START:', {
            userId: this.userId,
            runId: this.migrationCheckRunId
        });

        this.userService.startMigrationCheckWatcher(
            this.userId,
            this.migrationCheckRunId
        );
    }

    startForceStopTimer() {
        this.clearForceStopTimer();

        this.forceStopAvailable = false;

        this.forceStopTimer = setTimeout(() => {
            if (this.migrationCheckStatus === 'CHECKING') {
                this.forceStopAvailable = true;
            }
        }, 60 * 1000);
    }

    clearForceStopTimer() {
        if (this.forceStopTimer) {
            clearTimeout(this.forceStopTimer);
            this.forceStopTimer = null;
        }
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
            if (item.onlyOld?.length) {
                return `${item.dbName} DB에 1.5 버전에서 없는 프로퍼티가 있습니다: ${item.onlyOld.join(', ')}`;
            }

            if (item.onlyNew?.length) {
                return `${item.dbName} DB에 1.5 버전에서 새로 추가된 프로퍼티가 있습니다: ${item.onlyNew.join(', ')}`;
            }

            return `${item.dbName} DB의 프로퍼티 구성이 변경되었습니다.`;
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

        console.error('[Migration Check] 알 수 없는 결과 타입:', item);

        return `${item.dbName} DB 확인 중 오류가 발생했습니다.`;
    }

    forceStopMigrationCheck() {
        this.clearForceStopTimer();
        this.forceStopAvailable = false;

        this.userService.stopMigrationCheckWatcher();

        this.migrationCheckStatus = 'READY';
    }
}