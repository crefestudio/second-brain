import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

import { AuthService } from '../../../../../../../services/auth.service';
import { ToastService } from '../../../../../../../services/toast.service';
import { UserService, UserHabit } from '../../../../../../../services/user.service';

interface NotionGoal {
    id: string;
    name: string;
    status: string;
}

@Component({
    selector: 'app-my-routine',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './my-routine.component.html',
    styleUrls: ['./my-routine.component.scss']
})
export class MyRoutineComponent implements OnInit {

    isLoading = true;

    isDeleteConfirmOpen = false;
    deleteTargetHabit: UserHabit | null = null;

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    habits: UserHabit[] = [];

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
        try {
            await this.updateSession();

            if (this.userId) {
                await this.loadHabits();
                await this.loadGoals();
            }
        } finally {
            this.isLoading = false;
        }
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

    async loadHabits() {
        this.habits = await UserService.getUserHabits(this.userId);

        _log('loadHabits =>', this.habits);
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
        return this.habits.filter(habit =>
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

    getCategoryClass(habit: UserHabit): string {
        const category = this.categories.find(category =>
            habit.categories?.includes(category)
        );

        if (!category) {
            return 'category-default';
        }

        return 'category-' + category
            .replace(/\s/g, '-')
            .toLowerCase();
    }

    editHabit(habit: UserHabit) {
        this.editingHabit = {
            ...habit,
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
            icon: '🔄',
            name: '',
            categories: [],
            days: [...this.days],
            time: '09:00',
            duration: 5,
            status: '진행중',
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

}