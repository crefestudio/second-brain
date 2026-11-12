import { HABIT_RECOMMENDATIONS } from '../../habit-recommendations';
import { canUseAgent, isTemplateId } from '../../../../../../../config/template-catalog';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../../../services/auth.service';
import { UserService } from '../../../../../../../services/user.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';
import { ToastService } from '../../../../../../../services/toast.service';
import { TemplateUpgradeEventService } from '../../../../../../../services/template-upgrade-event.service';
import { ScrapbookUpgradeCardComponent } from '../../../../../../common/scrapbook-upgrade-card.component';

@Component({
    selector: 'app-routine-find',
    standalone: true,
    imports: [CommonModule, FormsModule, ScrapbookUpgradeCardComponent],
    templateUrl: './routine-find.component.html',
    styleUrls: ['./routine-find.component.scss']
})
export class RoutineFindComponent {

    selectedCategory = '추천';

    categories = [
        '추천',
        '모닝 루틴',
        '일과 시작 루틴',
        '일과 중 루틴',
        '저녁 루틴',
        '수면 루틴',
        '건강',
        '생활',
        '다이어트',
        '성장',
        '학습',
        '독서',
        '운동'
    ];

    habits = HABIT_RECOMMENDATIONS;

    weekDays = ['월', '화', '수', '목', '금', '토', '일'];

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private toastService: ToastService,
        private upgradeEvent: TemplateUpgradeEventService
        // private activateRouter: ActivatedRoute,
        // private router: Router
        //private appStatisticsStore: AppStatisticsStore,
        //public appService: NotePlatformService,
        //private alertService: BLAlertService,
    ) {

    }

    isLoading = true;
    async ngOnInit() {
        try {
            await this.updateSession();
        } finally {
            this.isLoading = false;
        }
    }

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';
    private addingHabits = new Set<any>();

    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();
        _log('updateSession memberUid, userId, notionAccessToken =>', this.memberUid, this.userId, this.kakaoUserId, this.notionAccessToken);
    }


    toggleDay(habit: any, day: string) {
        const index = habit.days.indexOf(day);

        if (index > -1) {
            habit.days.splice(index, 1);
        } else {
            habit.days.push(day);
        }
    }

    isSelected(habit: any, day: string) {
        return habit.days.includes(day);
    }

    isValidTime(time: unknown): boolean {
        return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    }

    async addHabit(habit: any) {
        if (!this.isValidTime(habit.time)) {
            ToastService.warning('시간을 입력해주세요.');
            return;
        }
        if (this.addingHabits.has(habit) || this.upgradeLoading || this.showUpgradeNotice) return;
        if (!this.memberUid) {
            ToastService.show('로그인이 필요합니다.');
            return;
        }

        if (!this.userId) {
            ToastService.show('먼저 연결 설정에서 구매인증을 완료해주세요.');
            return;
        }

        // A workspace must exist before its template can determine permission.
        if (!canUseAgent(this.authService.templateId, 'routine')) {
            if (isTemplateId(this.authService.templateId) && this.authService.templateId !== 'lifeUp') {
                this.upgradeLoading = true;
                this.addingHabits.add(habit);
                try { await this.upgradeEvent.initialize(this.userId, this.authService.templateId); }
                catch { /* Show the regular upgrade link if loading fails. */ }
                finally {
                    this.upgradeLoading = false;
                    this.addingHabits.delete(habit);
                }
                this.showUpgradeNotice = true;
            } else {
                ToastService.show('현재 템플릿에서는 루틴 추가를 지원하지 않습니다.');
            }
            return;
        }

        if (!this.notionAccessToken) {
            ToastService.show('라이프업 노션 템플릿과 연결을 완료해주세요.');
            return;
        }

        this.addingHabits.add(habit);
        try {
            const result = await UserService.addUserHabit(this.userId, habit);
            if (result.success) {
                const sync = await this.userService.syncMyHabitsWithUserId(this.userId, result.id);
                if (sync.success) ToastService.show('습관이 추가되고 노션에 동기화되었습니다.');
                else ToastService.warning('습관은 저장됐지만 노션 동기화에 실패했습니다. 루틴 동기화를 다시 실행해주세요.');
            }
            else if (result.duplicate) ToastService.warning(result.message || '기존 습관과 시간이 겹칩니다.');
            else ToastService.error('습관 추가에 실패했습니다.');
        } finally {
            this.addingHabits.delete(habit);
        }
    }

    isAddingHabit(habit: any): boolean {
        return this.addingHabits.has(habit);
    }
    showUpgradeNotice = false;
    private upgradeLoading = false;
    get upgradeUrl(): string { return this.upgradeEvent.upgradeUrl('routine_add'); }

    get filteredHabits() {
        if (!this.selectedCategory || this.selectedCategory === '전체') {
            return this.habits;
        }

        return this.habits.filter(r => r.categories?.includes(this.selectedCategory))
            .sort((a, b) => (a.routineOrder || Number.MAX_SAFE_INTEGER) - (b.routineOrder || Number.MAX_SAFE_INTEGER));
    }
}
