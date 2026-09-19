import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Subscription } from 'rxjs';
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
export class LifeupMigrationComponent implements OnInit, OnDestroy, AfterViewChecked {
    @ViewChildren('migrationConsole') private migrationConsoles!: QueryList<ElementRef<HTMLElement>>;
    private consoleItemCounts = new WeakMap<HTMLElement, number>();

    ngAfterViewChecked() {
        this.migrationConsoles.forEach(({ nativeElement: element }) => {
            const count = element.childElementCount;
            if (this.consoleItemCounts.get(element) !== count) {
                element.scrollTop = element.scrollHeight;
                this.consoleItemCounts.set(element, count);
            }
        });
    }

    private subscriptions = new Subscription();
    private destroyed = false;
    private migrationRestoreGeneration = 0;
    private migrationCheckRestoreGeneration = 0;
    migrationStarted = false;
    migrationRunId = '';
    migrationStatus = 'READY';
    migrationResults: any[] = [];
    migrationTotalCount = 0;
    migrationCompletedCount = 0;
    migrationComplete = false;
    migrationSuccess = false;
    migrationError = '';
    private migrationClock?: ReturnType<typeof setInterval>;
    migrationNow = Date.now();
    migrationRestartAfter = 0;
    migrationSupportsStop = false;
    migrationStopPending = false;

    get migrationCanRestart(): boolean {
        return !!this.migrationRunId && !this.migrationSuccess &&
            this.migrationRestartAfter > 0 && this.migrationNow >= this.migrationRestartAfter;
    }

    migrationCounting = false;
    migrationTotalCountReady = true;

    get migrationRemainingCount(): number {
        return Math.max(0, this.migrationTotalCount - this.migrationCompletedCount);
    }

    get migrationErrorCount(): number {
        return this.migrationResults.filter(
            (result) => result.status === 'error' && result.type === 'page-error',
        ).length;
    }

    get migrationWarningResults(): any[] {
        return this.migrationResults.filter(result => result.type === 'page-warning');
    }

    get migrationPageErrorResults(): any[] {
        return this.migrationResults.filter(result => result.type === 'page-error');
    }

    get migrationDatabaseSummaries(): Array<{ dbName: string; total: number; completed: number; warnings: number; errors: number; status: string }> {
        const databases = this.migrationResults.filter(result => result.type === 'database-complete');
        return databases.map(database => {
            const pages = this.migrationResults.filter(page =>
                page.dbName === database.dbName &&
                (page.type === 'page-complete' || page.type === 'page-warning' || page.type === 'page-error')
            );
            const warnings = pages.filter(page => page.type === 'page-warning').length;
            const errors = pages.filter(page => page.type === 'page-error').length;
            return {
                dbName: database.dbName,
                total: pages.length,
                completed: pages.length - errors,
                warnings,
                errors,
                status: errors ? 'error' : warnings ? 'warning' : 'ok'
            };
        });
    }

    get migrationResultTitle(): string {
        if (!this.migrationSuccess) return '일부 데이터 이전을 완료하지 못했습니다.';
        return this.migrationWarningResults.length ? '데이터 이전은 완료되었으며 확인이 필요한 항목이 있습니다.' : '데이터 이전을 완료했습니다.';
    }

    async openMigratedLifeup(): Promise<void> {
        try {
            const url = await this.userService.getMigrationTemplateRootUrl(this.userId);
            if (url) window.open(url, '_blank', 'noopener');
            else ToastService.error('새 라이프업 주소를 찾지 못했습니다.');
        } catch (error) {
            console.error('[Migration] failed to open new LifeUp', error);
            ToastService.error('새 라이프업 주소를 불러오지 못했습니다.');
        }
    }

    async disconnectMigrationNotion(): Promise<void> {
        if (!window.confirm('마이그레이션 연결을 해제하면 이번 업데이트 기록이 모두 초기화됩니다. 계속할까요?')) return;
        try {
            if (await this.userService.disconnectMigrationNotion(this.userId)) {
                ToastService.show('데이터 이전 연결을 해제했습니다.');
                window.location.replace(`${window.location.pathname}${window.location.search}`);
            } else {
                ToastService.error('데이터 이전 연결 해제에 실패했습니다.');
            }
        } catch (error) {
            console.error('[Migration] disconnect failed', error);
            ToastService.error('데이터 이전 연결 해제에 실패했습니다.');
        }
    }

    migrationStatusLabel(status: string, isCheck = false): string {
        const labels: Record<string, string> = isCheck
            ? {
                READY: '점검 준비',
                CHECKING: '점검 진행 중',
                COMPLETE: '점검 완료',
                ERROR: '점검 오류',
            }
            : {
                READY: '준비 중',
                MIGRATING: '이전 진행 중',
                STOPPING: '중단 요청 중',
                STOPPED: '중단됨',
                COMPLETE: '완료',
                ERROR: '오류',
            };
        return labels[status] || status;
    }

    migrationStatusClass(status: string): string {
        if (status === 'ERROR') return 'console-status-error';
        if (status === 'MIGRATING' || status === 'CHECKING' || status === 'COMPLETE') return 'console-status-success';
        if (status === 'STOPPING') return 'console-status-warning';
        return 'console-status-muted';
    }

    get migrationProgress(): number {
        return this.migrationTotalCount > 0
            ? Math.min(100, this.migrationCompletedCount / this.migrationTotalCount * 100)
            : this.migrationComplete && this.migrationSuccess ? 100 : 0;
    }

    private applyMigrationStatus(status: any) {
        this.migrationStarted = true;
        this.migrationCounting = status.phase === 'counting';
        this.migrationTotalCountReady = status.totalCountReady !== false;
        this.migrationRunId = status.runId;
        this.migrationTotalCount = status.totalCount || 0;
        this.migrationCompletedCount = status.completedCount || 0;
        this.migrationComplete = status.status === 'complete';
        this.migrationSuccess = this.migrationComplete && status.success === true;
        this.migrationStatus = this.migrationComplete
            ? (this.migrationSuccess ? 'COMPLETE' : 'ERROR') : (status.status || 'migrating').toUpperCase();
        this.migrationSupportsStop = !!status.restartTimeoutMs;
        this.migrationRestartAfter = ['stopped', 'error', 'complete'].includes(status.status)
            ? 1 : status.leaseExpiresAt?.toMillis?.() || (status.createdAt?.toMillis?.() || Date.now()) + 60 * 60 * 1000;
        this.migrationError = status.error || '';
        this.migrationNow = Date.now();
    }

    async restartMigration() {
        if (!this.migrationCanRestart) return;
        this.migrationStatus = 'MIGRATING';
        this.migrationComplete = false;
        this.migrationError = '';
        this.migrationRestartAfter = Date.now() + 5 * 60 * 1000;
        const result = await this.userService.migrateLifeUp(this.userId, this.migrationRunId, 'resume');
        if (this.destroyed) return;
        if (!result?.success) {
            await this.restoreMigration();
            this.migrationError = result?.message || '재시작 응답을 확인하지 못했습니다.';
        }
    }

    async stopMigration() {
        if (this.migrationStopPending || !this.migrationSupportsStop || this.migrationStatus !== 'MIGRATING') return;
        this.migrationStopPending = true;
        try {
            const result = await this.userService.migrateLifeUp(this.userId, this.migrationRunId, 'stop');
            if (!this.destroyed && !result?.success) this.migrationError = result?.message || '중단 요청에 실패했습니다.';
        } finally {
            this.migrationStopPending = false;
        }
    }
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
    private notionConnectWindow?: Window | null;

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
        this.migrationClock = setInterval(() => this.migrationNow = Date.now(), 1000);

        console.log('[Migration Check] restore step:', this.currentStep);

        this.subscriptions.add(this.userService.migrationCheckResult$.subscribe(result => {
            console.log('[Migration Check] watcher result:', result);
            this.mergeMigrationCheckResult(result);
        }));

        this.subscriptions.add(this.userService.migrationCheckStatus$.subscribe(status => {
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
        }));

        this.subscriptions.add(this.userService.migrationResult$.subscribe(result => {
            // Hide start/progress events, including logs saved by older workers.
            if (result.status !== 'ok' && result.status !== 'error' && result.status !== 'warning' && result.status !== 'notification') return;
            const index = this.migrationResults.findIndex(item =>
                item.id === result.id || (result.pageId && item.pageId === result.pageId)
            );
            if (index >= 0) this.migrationResults[index] = result;
            else this.migrationResults.push(result);
            this.migrationResults.sort((a, b) => (a.order || 0) - (b.order || 0));
        }));
        this.subscriptions.add(this.userService.migrationStatus$.subscribe(status => {
            if (status.status === 'watch-error') {
                this.migrationError = '진행 상태를 불러오지 못했습니다. 새로고침하여 다시 확인해주세요.';
                return;
            }
            this.applyMigrationStatus(status);
        }));
        this.subscriptions.add(this.userService.notionMigrationConnected$.subscribe(async () => {
            if (this.destroyed) return;
            // Reconnecting deletes integrations/migration in Firestore. Reload without the
            // step hash so no previous run, results, or completed screen remains in memory.
            this.resetMigrationState();
            this.resetMigrationCheckState();
            this.currentStep = 0;
            window.location.replace(`${window.location.pathname}${window.location.search}`);
        }));

        try {
            await this.initData();
            console.log('[Migration Check] userId:', this.userId);

            await Promise.allSettled([
                this.restoreMigrationCheck(),
                this.restoreMigration()
            ]);
        } finally {
            this.isLoading = false;
        }
    }

    ngOnDestroy() {
        this.destroyed = true;
        clearInterval(this.migrationClock);
        this.subscriptions.unsubscribe();
        this.clearForceStopTimer();
        this.userService.stopMigrationCheckWatcher();
        this.userService.stopMigrationWatcher();
    }

    private resetMigrationState() {
        this.migrationRestoreGeneration++;
        this.userService.stopMigrationWatcher();
        this.migrationStarted = false;
        this.migrationRunId = '';
        this.migrationStatus = 'READY';
        this.migrationResults = [];
        this.migrationTotalCount = 0;
        this.migrationCompletedCount = 0;
        this.migrationComplete = false;
        this.migrationSuccess = false;
        this.migrationError = '';
        this.migrationCounting = false;
        this.migrationTotalCountReady = true;
        this.migrationRestartAfter = 0;
        this.migrationSupportsStop = false;
        this.migrationStopPending = false;
    }

    private resetMigrationCheckState() {
        this.migrationCheckRestoreGeneration++;
        this.userService.stopMigrationCheckWatcher();
        this.clearForceStopTimer();
        this.forceStopAvailable = false;
        this.migrationCheckRunId = '';
        this.migrationCheckResults = [];
        this.migrationCheckTotalCount = 0;
        this.migrationCheckStatus = 'READY';
        this.migrationCheckComplete = false;
        this.migrationCheckSuccess = false;
    }

    private async restoreMigration() {
        if (!this.userId || this.destroyed) return;
        const generation = this.migrationRestoreGeneration;
        try {
            const run = await this.userService.getMigrationRun(this.userId);
            if (this.destroyed || generation !== this.migrationRestoreGeneration) return;
            if (run) {
                this.applyMigrationStatus(run);
                this.userService.startMigrationWatcher(this.userId, run.runId);
            } else {
                // The persisted migration log is the sole source of truth. No log means first start/reconnect.
                this.resetMigrationState();
            }
        } catch (error) {
            if (generation !== this.migrationRestoreGeneration) return;
            console.error('[Migration] restore failed:', error);
            this.migrationStarted = true;
            this.migrationStatus = 'ERROR';
            this.migrationError = '이전 진행 상태를 불러오지 못했습니다. 새로고침하여 다시 확인해주세요.';
        }
    }

    async startMigrationProcess() {
        if (!this.userId || this.migrationStarted) return;
        this.migrationStarted = true;
        this.migrationStatus = 'MIGRATING';
        this.migrationCounting = true;
        this.migrationTotalCountReady = false;
        this.migrationError = '';
        let previousRunId = '';

        try {
            const previousRun = await this.userService.getMigrationRun(this.userId);
            previousRunId = previousRun?.runId || '';
            if (this.destroyed) return;
            // The HTTP function returns after migration finishes, so discover the run via Firestore first.
            this.userService.watchNextMigrationRun(this.userId, previousRunId);
            const result = await this.userService.migrateLifeUp(this.userId);
            if (this.destroyed) return;
            if (result?.success && result.runId) {
                if (!this.migrationRunId) this.userService.startMigrationWatcher(this.userId, result.runId);
            } else if (!this.migrationComplete) {
                // The migration HTTP request stays open until the server worker finishes. A browser,
                // proxy, or network disconnect can therefore lose its response after the server has
                // already created the Firestore run. Reconcile the persisted run before clearing the
                // console or stopping its watcher.
                if (await this.restoreStartedMigration(previousRunId)) return;
                const message = result?.message || '데이터 이전을 시작하지 못했습니다. 다시 시도해주세요.';
                this.resetMigrationState();
                ToastService.error(message);
            }
        } catch (error) {
            console.error('[Migration] start failed:', error);
            if (await this.restoreStartedMigration(previousRunId)) return;
            this.resetMigrationState();
            ToastService.error('데이터 이전을 시작하지 못했습니다. 다시 시도해주세요.');
        }
    }

    private async restoreStartedMigration(previousRunId = ''): Promise<boolean> {
        // A run is claimed at the beginning of the server worker, but allow a short grace period
        // for Firestore visibility when the request itself failed before its response arrived.
        for (let attempt = 0; attempt < 3; attempt++) {
            if (this.destroyed) return false;
            try {
                const run = await this.userService.getMigrationRun(this.userId);
                if (run?.runId && run.runId !== previousRunId) {
                    console.warn('[Migration] recovered a run after the start response was unavailable', {
                        runId: run.runId,
                        attempt: attempt + 1
                    });
                    this.applyMigrationStatus(run);
                    this.userService.startMigrationWatcher(this.userId, run.runId);
                    return true;
                }
            } catch (error) {
                console.warn('[Migration] unable to reconcile migration run after start failure', error);
            }
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2_000));
        }
        return false;
    }

    async restoreMigrationCheck() {
        if (!this.userId) {
            return;
        }
        const generation = this.migrationCheckRestoreGeneration;

        const run = await this.userService.getMigrationCheckRun(this.userId);

        if (this.destroyed || generation !== this.migrationCheckRestoreGeneration) return;

        if (!run?.runId) {
            this.resetMigrationCheckState();
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

        if (this.destroyed || generation !== this.migrationCheckRestoreGeneration) return;

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

    async onClickConnectTemplate() {
        this.isOpenNotionConnectWindow = true;
        // Open synchronously from the click so browsers do not block the OAuth popup.
        this.notionConnectWindow = window.open('', '_blank');
        await this.userService.startNotionMigrationConnectWatcher(this.userId);
        await this.openNotionConnectWindow(this.notionConnectWindow);
    }

    onClickCancelConnectTemplateBtn() {
        this.isOpenNotionConnectWindow = false;
        this.userService.stopNotionMigrationConnectWatcher();
    }

    async openNotionConnectWindow(connectWindow?: Window | null) {
        _log('connectTemplate userId =>', this.userId);

        if (!this.userId) {
            return;
        }

        const encryptedUserId = await NACommonService.encrypt(this.userId);
        const baseUrl = window.location.origin;
        const serviceName = 'notion-migration-auth';
        const setupPath = 'connect';
        const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;

        if (connectWindow) {
            connectWindow.location.href = url;
        } else {
            window.open(url, '_blank');
        }
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
        // Ignore an older restore request that may still be resolving while this new check starts.
        this.migrationCheckRestoreGeneration++;
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
            if (item.renamed?.length || item.typeChanged?.length) {
                const changes: string[] = [];
                if (item.renamed?.length) {
                    changes.push(`필드명이 변경되었습니다: ${item.renamed.map((field: any) => `'${field.oldName}' → '${field.newName}'`).join(', ')}`);
                }
                if (item.onlyOld?.length) {
                    changes.push(`새 버전에서 삭제된 프로퍼티: ${item.onlyOld.join(', ')}`);
                }
                if (item.onlyNew?.length) {
                    changes.push(`새 버전에 추가된 프로퍼티: ${item.onlyNew.join(', ')}`);
                }
                if (item.typeChanged?.length) {
                    changes.push(`프로퍼티 형식이 변경되었습니다: ${item.typeChanged.map((field: any) => `${field.name} (${field.oldType} → ${field.newType})`).join(', ')}`);
                }
                return `${item.dbName} DB ${changes.join(' / ')}`;
            }

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
