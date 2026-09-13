import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../../../services/auth.service';
import { UserService } from '../../../../../../../services/user.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';
import { ToastService } from '../../../../../../../services/toast.service';

@Component({
    selector: 'app-routine-find',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './routine-find.component.html',
    styleUrls: ['./routine-find.component.scss']
})
export class RoutineFindComponent {

    selectedCategory = '추천';

    categories = [
        // '전체',
        '추천',
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

    // ❌ 기존 '인기' 제거
    // ✅ 대신 '추천' 추가

    habits = [
        // 💊 건강
        { icon: '💊', name: '유산균 섭취하기', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '💊', name: '비타민 챙겨 먹기', categories: ['건강', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '💧', name: '물 1.5L 이상 마시기', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '종일', duration: 5 },
        { icon: '💧', name: '공복에 물 한 잔', categories: ['건강', '아침 루틴', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:30', duration: 5 },
        { icon: '🧘', name: '아침 스트레칭', categories: ['건강', '아침 루틴', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:40', duration: 10 },
        { icon: '🚶', name: '가벼운 산책', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '18:00', duration: 30 },
        { icon: '🏃', name: '런닝머신', categories: ['건강', '운동'], days: ['월', '수', '금'], time: '19:00', duration: 30 },
        { icon: '☕', name: '커피 하루 2잔 이내', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '종일', duration: 5 },
        { icon: '👟', name: '6000보 이상 걷기', categories: ['건강', '운동', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '종일', duration: 5 },

        // 🏠 생활
        { icon: '🛏️', name: '침구 정리하기', categories: ['생활', '아침 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '📋', name: '오늘 할 일 정리하기', categories: ['생활', '아침 루틴', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:10', duration: 10 },
        { icon: '🧹', name: '방 정리하기', categories: ['생활'], days: ['월', '수', '금', '일'], time: '20:00', duration: 15 },
        { icon: '🪟', name: '집 환기하기', categories: ['생활', '아침 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:15', duration: 5 },
        { icon: '🍽️', name: '설거지 바로 하기', categories: ['생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '식사 후', duration: 5 },
        { icon: '🧽', name: '하루 10분 청소', categories: ['생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '20:30', duration: 10 },

        // 🔥 다이어트
        { icon: '🏃', name: '공복 걷기 30분', categories: ['다이어트', '운동'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:00', duration: 30 },
        { icon: '⛔', name: '저녁 6시 이후 금식', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '18:00', duration: 5 },
        { icon: '💧', name: '식사 전 물 한 컵', categories: ['다이어트', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '식사 전', duration: 5 },
        { icon: '🍚', name: '탄수화물 줄이기', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '식사', duration: 5 },
        { icon: '📊', name: '하루 칼로리 기록하기', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:30', duration: 5 },
        { icon: '⚖️', name: '몸무게 기록', categories: ['다이어트'], days: ['월', '수', '금'], time: '07:30', duration: 5 },

        // 🚀 성장
        { icon: '🎯', name: '하루 목표 3개 설정', categories: ['성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:05', duration: 5 },
        { icon: '📵', name: 'SNS 없이 2시간 집중', categories: ['성장', '추천'], days: ['월', '화', '수', '목', '금'], time: '10:00', duration: 120 },
        { icon: '📖', name: '이달의 책 읽기', categories: ['성장', '추천'], days: ['월', '화', '수', '목', '금'], time: '10:00', duration: 120 },
        { icon: '✍️', name: '일기 쓰기', categories: ['저녁 루틴', '성장', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:40', duration: 10 },

        // 🌅 아침 루틴
        { icon: '💧', name: '기상 후 물 한 잔', categories: ['아침 루틴', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:00', duration: 5 },
        { icon: '🛏️', name: '침대 정리하기', categories: ['아침 루틴', '생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:05', duration: 5 },
        { icon: '☀️', name: '햇빛 5분 쬐기', categories: ['아침 루틴', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:10', duration: 5 },
        { icon: '📅', name: '오늘 일정 정리', categories: ['아침 루틴', '생활', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:15', duration: 5 },
        { icon: '🧘', name: '간단 스트레칭', categories: ['아침 루틴', '건강', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:20', duration: 5 },

        // 🌙 저녁 루틴
        { icon: '📅', name: '내일 일정 정리', categories: ['저녁 루틴', '생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:00', duration: 10 },
        { icon: '📵', name: '스마트폰 30분 줄이기', categories: ['저녁 루틴', '성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:30', duration: 30 },
        { icon: '✍️', name: '하루 회고 작성', categories: ['저녁 루틴', '성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:40', duration: 10 },
        { icon: '📖', name: '독서 10분', categories: ['저녁 루틴', '독서'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:00', duration: 10 },
        { icon: '🧘', name: '스트레칭 후 취침 준비', categories: ['저녁 루틴', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:10', duration: 10 },

        // 📚 학습
        { icon: '🧠', name: '영어 단어 10개 암기', categories: ['학습'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '20:00', duration: 10 },
        { icon: '🎥', name: '강의 20분 시청', categories: ['학습'], days: ['월', '화', '수', '목', '금'], time: '20:20', duration: 20 },
        { icon: '📝', name: '복습 노트 정리', categories: ['학습'], days: ['월', '수', '금'], time: '20:50', duration: 15 },
        { icon: '🗣️', name: '영어 과외', categories: ['학습'], days: ['화', '목' ], time: '11:00', duration: 60 },

        // 📖 독서
        { icon: '📚', name: '책 읽기 15분', categories: ['독서'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:00', duration: 15 },
        { icon: '✍️', name: '핵심 문장 기록', categories: ['독서', '성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:15', duration: 5 },

        // 💪 운동
        { icon: '🏋️', name: '스쿼트 20회', categories: ['운동'], days: ['월', '수', '금'], time: '19:10', duration: 5 },
        { icon: '🧱', name: '플랭크 1분', categories: ['운동'], days: ['월', '수', '금'], time: '19:15', duration: 5 },
        { icon: '💪', name: '푸시업 10회', categories: ['운동'], days: ['월', '수', '금'], time: '19:20', duration: 5 },
        { icon: '🏠', name: '홈트 15분', categories: ['운동'], days: ['화', '목', '토'], time: '19:00', duration: 15 },
        { icon: '🧘', name: '스트레칭 10분', categories: ['운동', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:50', duration: 10 }
    ];

    weekDays = ['월', '화', '수', '목', '금', '토', '일'];

    constructor(
        private authService: AuthService,
        private toastService: ToastService
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

    async addHabit(habit: any) {
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

        const result = await UserService.addUserHabit(this.userId, habit);

        if (result.success) {
            ToastService.show('내 루틴에 습관이 추가되었습니다.');
        } else if (result.duplicate) {
            ToastService.warning(result.message || '기존 습관과 시간이 겹칩니다.');
        } else {
            ToastService.error('습관 추가에 실패했습니다.');
        }
    }

    get filteredHabits() {
        if (!this.selectedCategory || this.selectedCategory === '전체') {
            return this.habits;
        }

        return this.habits.filter(r =>
            r.categories?.includes(this.selectedCategory)
        );
    }
}