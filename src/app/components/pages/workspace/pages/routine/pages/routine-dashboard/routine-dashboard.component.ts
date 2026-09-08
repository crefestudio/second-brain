import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

import { AuthService } from '../../../../../../../services/auth.service';
import { ToastService } from '../../../../../../../services/toast.service';
import { UserService, UserHabit, NewAchievement } from '../../../../../../../services/user.service';
import { RouterLink } from '@angular/router';

// interface NotionGoal {
//     id: string;
//     name: string;
//     status: string;
// }

interface Goal {
    id: string;
    name: string;
    color: string;
}

export interface DailyStat {
    date: string;
    total: number;
    completed: number;
}

export interface DailyHabitStat extends DailyStat {
}

export interface GoalDailyStat extends DailyStat {
    goalId: string;
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

const DEFUALT_COLOR = '#3595df';

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

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    currentYear = new Date().getFullYear();
    days = ['월', '화', '수', '목', '금', '토', '일'];

    // 캘린더 시작/종료 시간
    startHour = 5;
    endHour = 29;

    // 한 시간의 높이
    hourHeight = 120;

    hourHeightLevels = [120, 180, 240, 60];
    hourHeightIndex = 0;

    goals: Goal[] = [];

    ///////////////////////////////////////////////////

    calendarWeeks: CalendarDay[][] = [];
    monthLabels: CalendarMonth[] = [];

    selectedGoalId = '';
    goalColor = DEFUALT_COLOR;

    currentStreak = 0;
    longestStreak = 0;
    completionRate = 0;
    totalCompleted = 0;

    statsMap = new Map<string, DailyStat>();

    ///////////////////////////////////////////////////
    // 배지, 트로피
    badges: NewAchievement[] = [];
    trophies: NewAchievement[] = [];
    newAchievements: NewAchievement[] = [];

    showBadgeHistory = false;
    badgeHistory: any[] = [];

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
                this.reloadAllData();
            }
        } finally {
            this.isLoading = false;
        }
    }

    async reloadAllData() {
        this.loadGoals();
        this.loadDailyStats();
        this.loadNewAchievements();
        this.loadHabitAchievements();
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

    selectGoal(goalId: string, color?: string): void {
        this.selectedGoalId = goalId;

        if (goalId === '') {
            this.goalColor = DEFUALT_COLOR;
        } else {
            const goal = this.goals.find(goal => goal.id === goalId);
            this.goalColor = color ?? DEFUALT_COLOR;
        }

        this.loadDailyStats();
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

    async onRecordMyDailyHabitStatsWithUserId(): Promise<void> {
        if (!this.userId) {
            return;
        }

        const result =
            await this.userService.recordMyDailyHabitStatsWithUserId(this.userId);

        if (!result.success) {
            ToastService.error('습관 기록 동기화에 실패했습니다.');
            return;
        }

        const messages: string[] = [];

        if (result.yesterday) {
            const { status } = result.yesterday;

            if (status === 'created') {
                messages.push('어제 기록이 새로 추가되었습니다.');
            } else if (status === 'updated') {
                messages.push('어제 기록이 업데이트되었습니다.');
            }
        }

        if (result.today) {
            const { status } = result.today;

            if (status === 'created') {
                messages.push('오늘 기록이 새로 추가되었습니다.');
            } else if (status === 'updated') {
                messages.push('오늘 기록이 업데이트되었습니다.');
            }
        }

        if (messages.length > 0) {
            ToastService.show(messages.join('\n'));
        } else {
            ToastService.show('어제와 오늘 기록이 모두 최신 상태입니다.');
        }

        this.loadDailyStats();
        this.loadNewAchievements();
        this.loadHabitAchievements();
    }

    buildCalendar(stats: DailyStat[]): void {
        this.statsMap.clear();

        for (const stat of stats) {
            this.statsMap.set(stat.date, stat);
        }

        const startDate = new Date(this.currentYear, 0, 1);
        const endDate = new Date(this.currentYear, 11, 31);

        // 월요일 시작
        const dayOfWeek = (startDate.getDay() + 6) % 7;
        startDate.setDate(startDate.getDate() - dayOfWeek);

        this.calendarWeeks = [];

        let current = new Date(startDate);
        let week: CalendarDay[] = [];

        while (current <= endDate || week.length > 0) {
            const dateString = this.formatDate(current);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const isFuture = current > today;
            const stat = this.statsMap.get(dateString);

            const completed = stat?.completed ?? 0;
            const total = stat?.total ?? 0;
            const completionRate = total > 0
                ? Math.round((completed / total) * 100)
                : 0;

            if (current.getFullYear() !== this.currentYear) {
                week.push({
                    date: '',
                    completed: 0,
                    total: 0,
                    completionRate: 0,
                    level: 0,
                    future: false
                });
            } else {
                week.push({
                    date: dateString,
                    completed,
                    total,
                    completionRate,
                    level: this.getActivityLevel(completionRate),
                    future: isFuture
                });
            }

            if (week.length === 7) {
                this.calendarWeeks.push(week);
                week = [];
            }

            current.setDate(current.getDate() + 1);

            if (current > endDate && week.length === 0) {
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

        this.currentStreak = this.calculateCurrentStreak();
        this.longestStreak = this.calculateLongestStreak();
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
            const dateString = this.formatDate(date);
            const stat = this.statsMap.get(dateString);

            if (stat && stat.completed > 0) {
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

    async loadDailyStats(): Promise<void> {
        try {
            const startDateString = `${this.currentYear}-01-01`;
            const endDateString = `${this.currentYear}-12-31`;

            if (this.selectedGoalId === '') {
                const stats = await this.userService.getDailyHabitStats(
                    this.userId,
                    startDateString,
                    endDateString
                );

                this.buildCalendar(stats);
                return;
            }

            // 목표 로드
            const stats = await this.userService.getGoalDailyStats(
                this.userId,
                this.selectedGoalId,
                startDateString,
                endDateString
            );

            _log('loadDailyStats stats =>', stats)

            this.buildCalendar(stats);

        } catch (error) {
            console.error(
                '[HabitDashboard] 일일 통계 조회 실패',
                error
            );

            this.calendarWeeks = [];
            this.monthLabels = [];
            this.currentStreak = 0;
            this.longestStreak = 0;
            this.completionRate = 0;
            this.totalCompleted = 0;
        }
    }

    //////////////////////////////////////////////////
    // #badge 배지, 트로피

    async loadHabitAchievements(): Promise<void> {
        if (!this.userId) {
            return;
        }

        try {
            const result =
                await this.userService.getHabitAchievements(
                    this.userId
                );

            this.badges = result.badges;
            this.trophies = result.trophies;

            this.newAchievements = [
                ...result.badges,
                ...result.trophies
            ].filter(
                achievement => !achievement.dismissedAt
            );

        } catch (error) {
            console.error(
                '[HabitDashboard] 성취 조회 실패',
                error
            );

            this.badges = [];
            this.trophies = [];
            this.newAchievements = [];
        }
    }

    async loadNewAchievements(): Promise<void> {
        if (!this.userId) { return; }

        try {
            const achievements = await this.userService.getNewHabitAchievements(this.userId);
            this.newAchievements = achievements;
        } catch (error) {
            console.error(
                '[HabitDashboard] 새 성취 조회 실패',
                error
            );
            this.newAchievements = [];
        }
    }

    async dismissAchievement(achievement: NewAchievement): Promise<void> {
        if (!this.userId) {
            return;
        }

        try {
            await this.userService.dismissHabitAchievement(
                this.userId,
                achievement.type,
                achievement.code
            );

            this.newAchievements =
                this.newAchievements.filter(
                    item => item.id !== achievement.id
                );
        } catch (error) {
            console.error(
                '[HabitDashboard] 성취 알림 닫기 실패',
                error
            );

            ToastService.error(
                '알림을 닫지 못했습니다.'
            );
        }
    }

    openBadgeHistory(): void {
        this.badgeHistory = [...this.badges].sort((a, b) => {
            const aTime = a.achievedAt?.toMillis?.() ?? new Date(a.achievedAt).getTime();
            const bTime = b.achievedAt?.toMillis?.() ?? new Date(b.achievedAt).getTime();
            return bTime - aTime;
        });

        this.showBadgeHistory = true;
    }

    closeBadgeHistory(): void {
        this.showBadgeHistory = false;
    }

    /////////////////
    showTrophyHistory = false;
    trophyHistory: any[] = [];

    openTrophyHistory(): void {
        this.trophyHistory = [...this.trophies].sort((a, b) => {
            const aTime = a.achievedAt?.toMillis?.() ?? 0;
            const bTime = b.achievedAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });

        this.showTrophyHistory = true;
    }

    closeTrophyHistory(): void {
        this.showTrophyHistory = false;
    }
    ///////////////


    formatBadgeDate(timestamp: any): string {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);

        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }
}


