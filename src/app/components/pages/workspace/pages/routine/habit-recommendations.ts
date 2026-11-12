export const HABIT_RECOMMENDATIONS = [
        // 💊 건강
        { icon: '💊', name: '유산균 섭취하기', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '💊', routineOrder: 5, name: '영양제·복용약 챙기기', description: '복용 중인 영양제와 약을 각 복용 안내에 맞춰 챙기기', categories: ['건강', '추천', '모닝 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '💧', name: '물 1.5L 이상 마시기', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },
        { icon: '💧', name: '공복에 물 한 잔', categories: ['건강', '모닝 루틴', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:30', duration: 5 },
        { icon: '🧘', routineOrder: 3, name: '아침 스트레칭', description: '기지개를 켜고 목과 어깨 가볍게 풀기', categories: ['건강', '모닝 루틴', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:40', duration: 10 },
        { icon: '🚶', routineOrder: 9, name: '가벼운 산책하기', description: '식사 후 10~20분 정도 가볍게 걷기', categories: ['건강', '일과 중 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '18:00', duration: 30 },
        { icon: '🏃', name: '런닝머신', categories: ['건강', '운동'], days: ['월', '수', '금'], time: '19:00', duration: 30 },
        { icon: '☕', name: '커피 하루 2잔 이내', categories: ['건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },
        { icon: '👟', name: '6000보 이상 걷기', categories: ['건강', '운동', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },

        // 🏠 생활
        { icon: '🛏️', routineOrder: 2, name: '이부자리 정리하기', description: '이불과 베개를 간단하게 정돈하기', categories: ['생활', '모닝 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:00', duration: 5 },
        { icon: '📋', routineOrder: 4, name: '오늘 할 일 정리하기', description: '5~10분 동안 오늘 할 일과 순서 정리하기', categories: ['생활', '모닝 루틴', '추천', '모닝 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:10', duration: 10 },
        { icon: '🧹', name: '방 정리하기', categories: ['생활'], days: ['월', '수', '금', '일'], time: '20:00', duration: 15 },
        { icon: '🪟', name: '집 환기하기', categories: ['생활', '모닝 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:15', duration: 5 },
        { icon: '🍽️', name: '설거지 바로 하기', categories: ['생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },
        { icon: '🧽', name: '하루 10분 청소', categories: ['생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '20:30', duration: 10 },

        // 🔥 다이어트
        { icon: '🏃', name: '공복 걷기 30분', categories: ['다이어트', '운동'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:00', duration: 30 },
        { icon: '⛔', name: '저녁 6시 이후 금식', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '18:00', duration: 5 },
        { icon: '💧', name: '식사 전 물 한 컵', categories: ['다이어트', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },
        { icon: '🍚', name: '탄수화물 줄이기', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '09:00', duration: 5 },
        { icon: '📊', name: '하루 칼로리 기록하기', categories: ['다이어트'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:30', duration: 5 },
        { icon: '⚖️', name: '몸무게 기록', categories: ['다이어트'], days: ['월', '수', '금'], time: '07:30', duration: 5 },

        // 🚀 성장
        { icon: '🎯', name: '하루 목표 3개 설정', categories: ['성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '08:05', duration: 5 },
        { icon: '📵', name: 'SNS 없이 2시간 집중', categories: ['성장', '추천'], days: ['월', '화', '수', '목', '금'], time: '10:00', duration: 120 },
        { icon: '📖', name: '이달의 책 읽기', categories: ['성장', '추천'], days: ['월', '화', '수', '목', '금'], time: '10:00', duration: 120 },
        { icon: '✍️', routineOrder: 15, name: '일기 쓰기', description: '오늘의 사건과 감정을 한두 줄로 기록하기', categories: ['수면 루틴', '성장', '추천', '수면 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:40', duration: 10 },

        // 🌅 아침 루틴
        { icon: '💧', routineOrder: 1, name: '기상 후 물 한 잔', description: '일어나 물 한 잔 마시기', categories: ['모닝 루틴', '건강', '모닝 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:00', duration: 5 },
        { icon: '🛏️', name: '침대 정리하기', categories: ['모닝 루틴', '생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:05', duration: 5 },
        { icon: '☀️', name: '햇빛 5분 쬐기', categories: ['모닝 루틴', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:10', duration: 5 },
        { icon: '📅', name: '오늘 일정 정리', categories: ['모닝 루틴', '생활', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:15', duration: 5 },
        { icon: '🧘', name: '간단 스트레칭', categories: ['모닝 루틴', '건강', '추천'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '07:20', duration: 5 },

        // 🌙 수면 루틴
        { icon: '📅', routineOrder: 12, name: '오늘 업무 정리 및 내일 일정 확인하기', description: '끝낸 일과 남은 일을 정리하고 내일 일정 확인하기', categories: ['수면 루틴', '생활'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:00', duration: 10 },
        { icon: '📵', name: '스마트폰 30분 줄이기', categories: ['수면 루틴', '성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:30', duration: 30 },
        { icon: '✍️', name: '하루 회고 작성', categories: ['수면 루틴', '성장'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:40', duration: 10 },
        { icon: '📖', routineOrder: 14, name: '책 10분 읽기', description: '스마트폰 대신 책을 펼쳐 10분 읽기', categories: ['수면 루틴', '독서'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:00', duration: 10 },
        { icon: '🧘', routineOrder: 16, name: '가볍게 스트레칭하기', description: '잠들기 전 편안한 범위에서 몸 풀기', categories: ['수면 루틴', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:10', duration: 10 },

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
        { icon: '🧘', name: '스트레칭 10분', categories: ['운동', '건강'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:50', duration: 10 },

        // 🚀 일과 시작 루틴
        { icon: '🎯', routineOrder: 6, name: '오늘 가장 중요한 일 하나 정하기', description: '오늘 우선적으로 끝낼 핵심 작업 하나 선택하기', categories: ['일과 시작 루틴'], days: ['월', '화', '수', '목', '금'], time: '09:00', duration: 5 },
        { icon: '⏱️', routineOrder: 7, name: '첫 집중 시간 25분 확보하기', description: '스마트폰 알림을 끄고 한 가지 작업에 집중하기', categories: ['일과 시작 루틴'], days: ['월', '화', '수', '목', '금'], time: '09:05', duration: 25 },
        { icon: '✅', routineOrder: 8, name: '미뤄둔 작은 일 하나 처리하기', description: '납부·정리·이메일 확인 등 미뤄온 일 처리하기', categories: ['일과 시작 루틴'], days: ['월', '화', '수', '목', '금'], time: '09:30', duration: 10 },
        // ☀️ 일과 중 루틴
        { icon: '🙆', routineOrder: 10, name: '잠깐 일어나 스트레칭하기', description: '오래 앉아 있었다면 일어나 목·어깨·허리 가볍게 풀기', categories: ['일과 중 루틴'], days: ['월', '화', '수', '목', '금'], time: '15:00', duration: 5 },
        // 🌆 저녁 루틴
        { icon: '🏃', routineOrder: 11, name: '내가 정한 운동하기', description: '유산소 운동이나 웨이트 트레이닝을 정해둔 요일에 실천하기', categories: ['저녁 루틴'], days: ['월', '수', '금'], time: '19:00', duration: 30 },
        { icon: '🎒', routineOrder: 13, name: '내일 입을 옷과 가방 준비하기', description: '다음 날 입을 옷과 필요한 물건 미리 챙기기', categories: ['수면 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '21:15', duration: 10 },
        { icon: '🌙', routineOrder: 17, name: '정해둔 시간에 잠자리 들기', description: '필요한 수면 시간을 고려해 일정한 시간에 잠자리 들기', categories: ['수면 루틴'], days: ['월', '화', '수', '목', '금', '토', '일'], time: '22:30', duration: 5 }
    ];

