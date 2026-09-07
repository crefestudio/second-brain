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

interface CalendarDay {
    date: string | null;
    completed: number;
    total: number;
    completionRate: number;
    level: number;
    future: boolean;
}

interface CalendarMonth {
    label: string;
    position: number;
}

@Component({
    selector: 'app-routine-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink
    ],
    templateUrl: './routine-dashboard.component.html',
    styleUrls: ['./routine-dashboard.component.scss']
})
export class RoutineDashboardComponent implements OnInit {

    isLoading = true;

    habits: UserHabit[] = [];
    filteredHabits: UserHabit[] = [];
    selectedGoal = '';

    isDeleteConfirmOpen = false;
    deleteTargetHabit: UserHabit | null = null;

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    currentYear = new Date().getFullYear();

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

    ///////////////////////////////////////////////////

    calendarWeeks: CalendarDay[][] = [];
    monthLabels: CalendarMonth[] = [];

    selectedGoalId = 'all';

    _goals: Goal[] = [];

    goalColor = '#2dd4bf';

    currentStreak = 0;
    longestStreak = 0;
    completionRate = 0;
    totalCompleted = 0;

    private statsMap = new Map<string, GoalDailyStat>();

    ///////////////////////////////////////////////////

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
            this.generateCalendarWeeks(2026);
            this.generateMonthLabels(2026);
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
        this.refreshFilteredHabits();

        _log('loadHabits =>', this.habits);
    }

    async loadGoals() {
        if (!this.userId) {
            return;
        }

        try {
            this.goals = await this.userService.getNotionGoals(this.userId);

            // if (result?.success) {
            //     this.goals = result.goals ?? [];
            // }
        } catch (error) {
            console.error('[Habit] 목표 조회 실패:', error);
            this.goals = [];
        }
    }

    private generateMonthLabels(year: number): void {
        const labels: CalendarMonth[] = [];
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
            'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const totalWeeks = this.calendarWeeks.length;

        for (let month = 0; month < 12; month++) {
            const date = new Date(year, month, 1);
            const dayOfYear = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000);
            const weekIndex = Math.floor((dayOfYear + 3) / 7);

            labels.push({
                label: months[month],
                position: (weekIndex / totalWeeks) * 100
            });
        }

        this.monthLabels = labels;
    }

    private generateCalendarWeeks(year: number): void {
        const weeks: CalendarDay[][] = [];
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        const firstDay = (startDate.getDay() + 6) % 7;
        let week: CalendarDay[] = [];

        for (let i = 0; i < firstDay; i++) {
            week.push({
                date: null,
                completed: 0,
                total: 0,
                completionRate: 0,
                level: 0,
                future: false
            });
        }

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            week.push({
                date: this.formatDate(date),
                completed: 0,
                total: 0,
                completionRate: 0,
                level: 0,
                future: date > new Date()
            });

            if (week.length === 7) {
                weeks.push(week);
                week = [];
            }
        }

        if (week.length > 0) {
            while (week.length < 7) {
                week.push({
                    date: null,
                    completed: 0,
                    total: 0,
                    completionRate: 0,
                    level: 0,
                    future: false
                });
            }
            weeks.push(week);
        }

        this.calendarWeeks = weeks;
    }

    // private formatDate(date: Date): string {
    //     const year = date.getFullYear();
    //     const month = String(date.getMonth() + 1).padStart(2, '0');
    //     const day = String(date.getDate()).padStart(2, '0');
    //     return `${year}-${month}-${day}`;
    // }

    selectGoal(goalId: string): void {
        this.selectedGoal = goalId;
        this.refreshFilteredHabits();
    }

    private refreshFilteredHabits(): void {
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

        ToastService.show('습관이 수정되었습니다.');
    }

    async createHabit() {
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

        const result = await UserService.addUserHabit(
            this.userId,
            this.editingHabit!
        );

        if (result.success) {
            this.editingHabit = null;
            await this.loadHabits();
            ToastService.show('내 루틴에 습관이 추가되었습니다.');
        } else if (result.duplicate) {
            ToastService.warning(
                result.message || '기존 습관과 시간이 겹칩니다.'
            );
        } else {
            ToastService.error('습관 추가에 실패했습니다.');
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

        const result = await this.userService.createMyDailyHabitLogsWithUserId(this.userId);

        if (!result.success) {
            ToastService.error('습관 추가에 실패했습니다.');
            return;
        }

        if (result.createdCount > 0 && result.existingCount > 0) {
            ToastService.show(
                `새 습관 ${result.createdCount}개가 추가되었습니다.\n` +
                `동일한 습관 ${result.existingCount}개는 이미 있어 새로 추가하지 않았습니다.`
            );

        } else if (result.createdCount > 0) {
            ToastService.show(
                `새 습관 ${result.createdCount}개가 추가되었습니다.`
            );

        } else if (result.existingCount > 0) {
            ToastService.show(
                `이미 동일한 ${result.existingCount}개 습관이 있어 새로 추가하지 않았습니다.`
            );

        } else {
            ToastService.show(
                '추가할 습관이 없습니다.'
            );
        }
    }

    async onSyncHabits(): Promise<void> {
        if (!this.userId) {
            return;
        }

        const result = await this.userService.syncMyHabitsWithUserId(this.userId);

        if (!result.success) {
            ToastService.error('내 루틴 동기화에 실패했습니다.');
            return;
        }

        if (result.createdCount > 0 && result.updatedCount > 0) {
            ToastService.show(
                `새 루틴 ${result.createdCount}개가 추가되고\n` +
                `기존 루틴 ${result.updatedCount}개가 업데이트되었습니다.`
            );

        } else if (result.createdCount > 0) {
            ToastService.show(
                `새 루틴 ${result.createdCount}개가 추가되었습니다.`
            );

        } else if (result.updatedCount > 0) {
            ToastService.show(
                `모든 루틴이 이미 동기화되어 있습니다.`
            );

        } else {
            ToastService.show(
                '동기화할 루틴이 없습니다.'
            );
        }
    }

    async onRecordMyDailyHabitStatsWithUserId() {
        alert('onRecordMyDailyHabitStatsWithUserId');
        const result = await this.userService.recordMyDailyHabitStatsWithUserId(this.userId);
        // onRecordMyDailyHabitStatsWithUserId
    }

    buildCalendar(stats: GoalDailyStat[]): void {
        this.statsMap.clear();

        for (const stat of stats) {
            this.statsMap.set(stat.date, stat);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1);

        // 월요일 시작
        const dayOfWeek = (startDate.getDay() + 6) % 7;
        startDate.setDate(startDate.getDate() - dayOfWeek);

        this.calendarWeeks = [];

        let current = new Date(startDate);
        let week: CalendarDay[] = [];

        while (current <= today || week.length > 0) {
            const dateString = this.formatDate(current);
            const isFuture = current > today;
            const stat = this.statsMap.get(dateString);

            week.push({
                date: dateString,
                completed: stat?.completed ?? 0,
                total: stat?.total ?? 0,
                completionRate: stat?.completionRate ?? 0,
                level: this.getActivityLevel(stat?.completionRate ?? 0),
                future: isFuture
            });

            if (week.length === 7) {
                this.calendarWeeks.push(week);
                week = [];
            }

            current.setDate(current.getDate() + 1);

            if (current > today && week.length === 0) {
                break;
            }
        }

        this.buildMonthLabels();
        this.calculateStats();
    }

    getActivityLevel(progress: number): number {
        if (progress <= 0) return 0;
        if (progress <= 20) return 1;
        if (progress <= 40) return 2;
        if (progress <= 60) return 3;
        if (progress <= 80) return 4;
        return 4;
    }

    private formatDate(
        date: Date
    ): string {

        return [
            date.getFullYear(),
            String(
                date.getMonth() + 1
            ).padStart(2, '0'),
            String(
                date.getDate()
            ).padStart(2, '0')
        ].join('-');
    }

    private buildMonthLabels(): void {

        this.monthLabels = [];

        let previousMonth = -1;

        this.calendarWeeks.forEach(
            (week, index) => {

                const firstDay = week.find(
                    day => day.date
                );

                if (!firstDay?.date) {
                    return;
                }

                const date =
                    new Date(firstDay.date);

                const month =
                    date.getMonth();

                if (month !== previousMonth) {

                    this.monthLabels.push({
                        label: date.toLocaleString(
                            'en-US',
                            {
                                month: 'short'
                            }
                        ),
                        position:
                            (index /
                                this.calendarWeeks.length
                            ) * 100
                    });

                    previousMonth = month;
                }
            }
        );
    }

    private calculateStats(): void {

        const stats =
            Array.from(
                this.statsMap.values()
            );


        this.totalCompleted =
            stats.reduce(
                (sum, stat) =>
                    sum + stat.completed,
                0
            );


        const total =
            stats.reduce(
                (sum, stat) =>
                    sum + stat.total,
                0
            );


        this.completionRate =
            total > 0
                ? Math.round(
                    (this.totalCompleted / total) * 100
                )
                : 0;


        this.currentStreak =
            this.calculateCurrentStreak();


        this.longestStreak =
            this.calculateLongestStreak();
    }

    private calculateCurrentStreak(): number {

        let streak = 0;

        const today = new Date();

        today.setHours(0, 0, 0, 0);


        for (let i = 0; i < 365; i++) {

            const date = new Date(today);

            date.setDate(
                today.getDate() - i
            );


            const dateString =
                this.formatDate(date);

            const stat =
                this.statsMap.get(dateString);


            if (
                stat &&
                stat.completed > 0
            ) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    private calculateLongestStreak(): number {
        let longest = 0;
        let current = 0;

        const dates =
            Array.from(
                this.statsMap.keys()
            ).sort();

        for (const date of dates) {
            const stat = this.statsMap.get(date);
            if (stat && stat.completed > 0) {
                current++;
                longest =
                    Math.max(
                        longest,
                        current
                    );

            } else {
                current = 0;
            }
        }
        return longest;
    }

    getDayTitle(
        day: CalendarDay
    ): string {

        if (!day.date) {
            return '';
        }

        if (day.future) {
            return day.date;
        }

        return `${day.date}
${day.completed}/${day.total} 완료
완료율 ${day.completionRate}%`;
    }

    onGoalChange(): void {
        if (this.selectedGoalId === 'all') {
            this.goalColor = '#2dd4bf';
        } else {
            const goal =
                this._goals.find(
                    g =>
                        g.id === this.selectedGoalId
                );

            this.goalColor =
                goal?.color ?? '#2dd4bf';
        }
        //this.loadDailyStats();
    }

    // async loadDailyStats(): Promise<void> {
    //     try {
    //         const today = new Date();
    //         today.setHours(0, 0, 0, 0);

    //         const startDate = new Date(today);
    //         startDate.setFullYear(
    //             startDate.getFullYear() - 1
    //         );
    //         startDate.setDate(
    //             startDate.getDate() + 1
    //         );

    //         const startDateString =
    //             this.formatDate(startDate);

    //         const endDateString =
    //             this.formatDate(today);


    //         // ========================================
    //         // 전체 습관
    //         // ========================================

    //         if (this.selectedGoalId === 'all') {

    //             const snapshot = await this.firestore
    //                 .collection(
    //                     `users/${this.userId}/integrations/routine/dailyStats`
    //                 )
    //                 .where(
    //                     'date',
    //                     '>=',
    //                     startDateString
    //                 )
    //                 .where(
    //                     'date',
    //                     '<=',
    //                     endDateString
    //                 )
    //                 .orderBy('date', 'asc')
    //                 .get();

    //             const stats: GoalDailyStat[] =
    //                 snapshot.docs.map(doc => ({
    //                     ...(doc.data() as GoalDailyStat)
    //                 }));

    //             this.buildCalendar(stats);

    //             return;
    //         }


    //         // ========================================
    //         // 특정 목표
    //         // ========================================

    //         const snapshot = await this.firestore
    //             .collection(
    //                 `users/${this.userId}/integrations/routine/goalDailyStats`
    //             )
    //             .where(
    //                 'goalId',
    //                 '==',
    //                 this.selectedGoalId
    //             )
    //             .where(
    //                 'date',
    //                 '>=',
    //                 startDateString
    //             )
    //             .where(
    //                 'date',
    //                 '<=',
    //                 endDateString
    //             )
    //             .orderBy('date', 'asc')
    //             .get();


    //         const stats: GoalDailyStat[] =
    //             snapshot.docs.map(doc => ({
    //                 ...(doc.data() as GoalDailyStat)
    //             }));


    //         this.buildCalendar(stats);

    //     } catch (error) {

    //         console.error(
    //             '[HabitDashboard] 일일 통계 조회 실패',
    //             error
    //         );

    //         this.calendarWeeks = [];
    //         this.monthLabels = [];

    //         this.currentStreak = 0;
    //         this.longestStreak = 0;
    //         this.completionRate = 0;
    //         this.totalCompleted = 0;
    //     }
    // }
}


