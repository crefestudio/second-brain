import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

import { AuthService } from '../../../../../../../services/auth.service';
import { ToastService } from '../../../../../../../services/toast.service';
import { UserService, UserHabit } from '../../../../../../../services/user.service';
import { RouterLink } from '@angular/router';

interface NotionGoal {
    id: string;
    name: string;
    status: string;
}

interface Goal {
    id: string;
    name: string;
    color: string;
}

interface GoalDailyStat {
    date: string;
    goalId: string;
    total: number;
    completed: number;
    completionRate: number;
}

interface CalendarMonth {
    label: string;
    position: number;
}



@Component({
    selector: 'app-my-routine',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink
    ],
    templateUrl: './my-routine.component.html',
    styleUrls: ['./my-routine.component.scss']
})
export class MyRoutineComponent implements OnInit {

    isLoading = true;
    isCreatingHabit = false;

    habits: UserHabit[] = [];
    filteredHabits: UserHabit[] = [];
    selectedGoal = '';

    isDeleteConfirmOpen = false;
    deleteTargetHabit: UserHabit | null = null;

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';


    days = ['월', '화', '수', '목', '금', '토', '일'];

    categories = [
        // '추천',
        '건강',
        '생활',
        '다이어트',
        '성장',
        '아침 루틴',
        '저녁 루틴',
        '학습',
        '독서',
        '운동'
    ];

    // 캘린더 시작/종료 시간
    startHour = 5;
    endHour = 29;

    // 한 시간의 높이
    hourHeight = 120;

    hourHeightLevels = [120, 180, 240, 60];
    hourHeightIndex = 0;

    goals: NotionGoal[] = [];
    routineGoals: NotionGoal[] = [];
    readonly uncategorizedGoalId = '__routine_uncategorized__';
    hasUncategorizedHabits = false;

    toggleCalendarZoom() {
        this.hourHeightIndex =
            (this.hourHeightIndex + 1) % this.hourHeightLevels.length;

        this.hourHeight = this.hourHeightLevels[this.hourHeightIndex];
    }
    /////////////////////////

    editingHabit: UserHabit | null = null;

    constructor(
        private authService: AuthService,
        private toastService: ToastService,
        private userService: UserService
    ) {
    }

    async ngOnInit() {
        this.isLoading = true;
        try {
            await this.updateSession();

            if (this.userId) {
                await this.loadGoals();
                await this.loadHabits();
            }
        } finally {
            this.isLoading = false;
        }
    }

    async loadHabits() {
        this.habits = await UserService.getUserHabits(this.userId);
        this.refreshRoutineGoals();
        this.refreshFilteredHabits();

        _log('loadHabits =>', this.habits);
    }

    async loadGoals() {
        if (!this.userId) {
            return;
        }

        try {
            this.goals = await this.userService.getNotionGoals(this.userId);
            this.refreshRoutineGoals();

            // if (result?.success) {
            //     this.goals = result.goals ?? [];
            // }
        } catch (error) {
            console.error('[Habit] 목표 조회 실패:', error);
            this.goals = [];
        }
    }

    selectGoal(goalId: string): void {
        this.selectedGoal = goalId;
        this.refreshFilteredHabits();
    }

    /**
     * 화면의 "내 목표"에는 실제로 루틴이 연결된 목표만 표시한다.
     * goals는 추가·수정 모달의 전체 목표 선택지를 위해 그대로 유지한다.
     */
    private refreshRoutineGoals(): void {
        const routineGoalIds = new Set(
            this.habits
                .map(habit => habit.goalId)
                .filter((goalId): goalId is string => Boolean(goalId))
        );

        this.routineGoals = this.goals.filter(goal => routineGoalIds.has(goal.id));
        this.hasUncategorizedHabits = this.habits.some(habit => !habit.goalId);

        if (
            this.selectedGoal &&
            this.selectedGoal !== this.uncategorizedGoalId &&
            !routineGoalIds.has(this.selectedGoal)
        ) {
            this.selectedGoal = '';
        }

        if (this.selectedGoal === this.uncategorizedGoalId && !this.hasUncategorizedHabits) {
            this.selectedGoal = '';
        }
    }

    private refreshFilteredHabits(): void {
        if (this.selectedGoal === this.uncategorizedGoalId) {
            this.filteredHabits = this.habits.filter(habit => !habit.goalId);
            return;
        }

        this.filteredHabits = this.selectedGoal
            ? this.habits.filter(habit => habit.goalId === this.selectedGoal)
            : this.habits;
    }

    async updateSession() {
        await this.authService.updateSession();

        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log(
            'updateSession memberUid, userId, notionAccessToken =>',
            this.memberUid,
            this.userId,
            this.kakaoUserId,
            this.notionAccessToken
        );
    }


    getHours(): number[] {
        const hours: number[] = [];

        for (let hour = this.startHour; hour < this.endHour; hour++) {
            hours.push(hour);
        }

        return hours;
    }

    getDisplayHour(hour: number): string {
        const displayHour = hour >= 24 ? hour - 24 : hour;
        return `${displayHour}:00`;
    }


    getDayHabits(day: string): UserHabit[] {
        return this.filteredHabits.filter(habit =>
            habit.days?.includes(day) &&
            this.isValidTime(habit.time)
        );
    }

    isValidTime(time: string): boolean {
        return /^\d{2}:\d{2}$/.test(time);
    }

    getHabitTop(habit: UserHabit): number {
        const [hour, minute] = habit.time.split(':').map(Number);

        return ((hour - this.startHour) * 60 + minute) * this.hourHeight / 60;
    }

    getHabitHeight(habit: UserHabit): number {
        const duration = Math.max(5, habit.duration || 5);

        return Math.max(24, duration * this.hourHeight / 60);
    }

    // getCategoryClass(habit: UserHabit): string {
    //     const category = this.categories.find(category =>
    //         habit.categories?.includes(category)
    //     );

    //     if (!category) {
    //         return 'category-default';
    //     }

    //     return 'category-' + category
    //         .replace(/\s/g, '-')
    //         .toLowerCase();
    // }

    editHabit(habit: UserHabit) {
        this.editingHabit = {
            ...habit,
            goalId: habit.goalId ?? '',
            name: habit.name.replace(`${habit.icon ?? ''} `, '')
        };
    }

    closeEditHabit() {
        this.editingHabit = null;
    }

    async saveHabit() {
        if (!this.editingHabit) {
            return;
        }

        if (!this.editingHabit.name.trim()) {
            ToastService.warning('습관 이름을 입력해주세요.');
            return;
        }

        if (!this.editingHabit.days?.length) {
            ToastService.warning('반복할 요일을 선택해주세요.');
            return;
        }

        if (this.editingHabit.id) {
            await this.updateHabit();
        } else {
            await this.createHabit();
        }
    }

    deleteHabit(habit: UserHabit) {
        this.deleteTargetHabit = habit;
        this.isDeleteConfirmOpen = true;
    }

    cancelDeleteHabit() {
        this.isDeleteConfirmOpen = false;
        this.deleteTargetHabit = null;
    }

    async confirmDeleteHabit() {
        if (!this.deleteTargetHabit?.id) return;

        const success = await UserService.deleteUserHabit(
            this.userId,
            this.deleteTargetHabit.id
        );

        if (!success) {
            ToastService.show('습관 삭제에 실패했습니다.');
            return;
        }

        this.habits = this.habits.filter(
            item => item.id !== this.deleteTargetHabit!.id
        );
        this.refreshRoutineGoals();
        this.refreshFilteredHabits();

        this.isDeleteConfirmOpen = false;
        this.deleteTargetHabit = null;

        ToastService.show('습관이 삭제되었습니다.');
    }

    toggleDay(habit: any, day: string) {
        const index = habit.days.indexOf(day);

        if (index === -1) {
            habit.days.push(day);
        } else {
            habit.days.splice(index, 1);
        }
    }

    isSelected(habit: any, day: string) {
        return habit.days.includes(day);
    }

    openAddHabit() {
        this.editingHabit = {
            goalId: '',
            icon: '',
            name: '',
            categories: [],
            days: [],
            time: '07:00',
            duration: 30,
            status: '진행 중',
            notify: true
        };
    }

    async updateHabit() {
        const habitId = this.editingHabit!.id;
        const result = await UserService.updateUserHabit(
            this.userId,
            this.editingHabit!
        );

        if (!result.success) {
            if (result.duplicate) {
                ToastService.warning(
                    result.message || '기존 습관과 시간이 겹칩니다.'
                );
            } else {
                ToastService.error('습관 수정에 실패했습니다.');
            }

            return;
        }

        this.editingHabit = null;
        await this.loadHabits();

        const sync = await this.userService.syncMyHabitsWithUserId(this.userId, habitId);
        if (sync.success) ToastService.show('습관이 수정되고 노션에 동기화되었습니다.');
        else ToastService.warning('습관은 저장됐지만 노션 동기화에 실패했습니다. 루틴 동기화를 다시 실행해주세요.');
    }

    async createHabit() {
        if (this.isCreatingHabit) return;
        if (!this.memberUid) {
            ToastService.show('로그인이 필요합니다.');
            return;
        }

        if (!this.userId) {
            ToastService.show('먼저 연결관리에서 라이프봇 연결을 진행해주세요.');
            return;
        }

        if (!this.notionAccessToken) {
            ToastService.show('라이프업 노션 템플릿과 연결을 완료해주세요.');
            return;
        }

        this.isCreatingHabit = true;
        try {
            const result = await UserService.addUserHabit(this.userId, this.editingHabit!);

            if (result.success) {
                this.editingHabit = null;
                await this.loadHabits();
                const sync = await this.userService.syncMyHabitsWithUserId(this.userId, result.id);
                if (sync.success) ToastService.show('습관이 추가되고 노션에 동기화되었습니다.');
                else ToastService.warning('습관은 저장됐지만 노션 동기화에 실패했습니다. 루틴 동기화를 다시 실행해주세요.');
            } else if (result.duplicate) {
                ToastService.warning(result.message || '기존 습관과 시간이 겹칩니다.');
            } else {
                ToastService.error('습관 추가에 실패했습니다.');
            }
        } finally {
            this.isCreatingHabit = false;
        }
    }

    getHabitGoalClass(habit: UserHabit): string {
        if (!habit.goalId) {
            return 'Habit-goal-default';
        }

        const index = this.goals.findIndex(goal => goal.id === habit.goalId);

        return index >= 0 ? `Habit-goal-${index % this.goalColors.length}` : 'Habit-goal-default';
    }

    goalColors = [
        '#60a5fa',
        '#4ade80',
        '#fbbf24',
        '#c084fc',
        '#fb7185',
        '#38bdf8',
        '#f97316',
        '#818cf8',
        '#2dd4bf',
        '#e879f9',
        '#a3e635',
        '#f87171'
    ];

    getGoalColor(index: number): string {
        return this.goalColors[index % this.goalColors.length];
    }

    async onCreateDailyHabitLogs(): Promise<void> {
        if (!this.userId) {
            return;
        }

        const sync = await this.userService.syncMyHabitsWithUserId(this.userId);
        if (!sync.success) {
            ToastService.error('노션의 습관 정보를 맞추지 못했습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const result = await this.userService.createMyDailyHabitLogsWithUserId(this.userId);

        if (result.failedCount || result.pendingCount) {
            ToastService.warning(`새 기록 ${result.createdCount}개, 기존 기록 ${result.existingCount}개, 실패 ${result.failedCount || 0}개, 처리 중 ${result.pendingCount || 0}개입니다. 잠시 후 다시 확인해주세요.`);
            return;
        }
        if (!result.success) {
            ToastService.error('습관 추가에 실패했습니다.');
            return;
        }

        if (result.createdCount > 0 && result.existingCount > 0) {
            ToastService.show(
                `노션 습관 ${sync.createdCount}개를 추가하고 ${sync.updatedCount}개를 확인했습니다.\n` +
                `오늘 일정 ${result.createdCount}개를 추가했고, ${result.existingCount}개는 이미 있습니다.`
            );

        } else if (result.createdCount > 0) {
            ToastService.show(
                `노션 습관 ${sync.createdCount}개를 추가하고 ${sync.updatedCount}개를 확인했습니다.\n` +
                `오늘 일정 ${result.createdCount}개를 추가했습니다.`
            );

        } else if (result.existingCount > 0) {
            ToastService.show(
                `노션 습관을 확인했습니다. 오늘 일정 ${result.existingCount}개는 이미 있습니다.`
            );

        } else {
            ToastService.show(
                '노션 습관을 확인했습니다. 오늘 추가할 일정은 없습니다.'
            );
        }
    }

}


