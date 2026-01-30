import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';


import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';
import { NotionService } from '../../../services/notion.service';
import { UserService } from '../../../services/user.service';


@Component({
    selector: 'app-connect',
    standalone: true,  
    templateUrl: './secondbrain.connect.component.html',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./secondbrain.connect.component.css']
})
export class SecondBrainConnectComponent implements OnInit {
    //private userService = inject(UserService);
    
    state: string = '';
    phoneNumber: string = '';
    databaseData: any;
    private config = inject<AppConfig>(APP_CONFIG);
    activeTab: 'installed' | 'not-installed' = 'installed';

    //
    userId: string = '';
    workspaceName: string = '';
    botId: string = '';

    selectTab(tab: 'installed' | 'not-installed') {
        this.activeTab = tab;
    }
 
    constructor(private notionService: NotionService) { 

    }


    async ngOnInit() {
        // try {
        //     this.databaseData = await this.notionService.getDatabase();
        //     console.log(this.databaseData);
        // } catch (err) {
        //     console.error(err);
        // }
    }

    // async onConfirm() {
    //     if (!this.phoneNumber) return;

    //     try {
    //         await UserService.savePhoneNumber(this.phoneNumber); 
    //     } catch (e) {
    //         console.error('저장 실패', e);
    //     }
    // }

    async onConfirm() {
        if (!this.phoneNumber) return;

        // 1. 전화번호 형식 검증
        const isValid = /^010-\d{4}-\d{4}$/.test(this.phoneNumber);
        if (!isValid) {
            alert('전화번호 형식은 010-0000-0000 입니다.');
            return;
        }

        try {
            /**
             * 2. 구매자 검증
             * - 서버(Firebase Function)에서
             *   → 해당 전화번호가 LifeUp 템플릿 구매자인지 확인
             * - true: 통과
             * - false: 차단
             */
            // const isBuyer = await UserService.verifyBuyerPhone(this.phoneNumber);
            // if (!isBuyer) {
            //     alert('정식 구매자만 이용할 수 있는 서비스입니다.');
            //     return;
            // }

            /**
             * 3. 이미 등록된 유저인지 확인
             * - 등록된 경우: 로그인 처리
             * - 없으면: 신규 user 생성
             */
            const userId = '11'; //await this.userService.checkPhoneExists(this.phoneNumber);

            if (userId) {
                // 기존 유저
                this.userId = userId;
                this.state = 'logined';
                console.log('이미 등록된 사용자', userId);
            } else {
                // 신규 유저 생성 → userId 반환받기
                const newUserId = await UserService.savePhoneNumber(this.phoneNumber);
                this.userId = newUserId;
                this.state = 'logined';
            }

        } catch (e) {
            console.error('저장 실패', e);
            alert('저장 중 오류가 발생했습니다.');
            return;
        }

        /**
         * 4. 로그인 이후 연결 정보 조회
         */
        // 로그인 완료 후
        //const connectedInfo = await this.userService.getUserConnectedInfo(this.userId);

        // if (!connectedInfo) {
        //     this.state = 'connecting';   // 아직 Notion 연결 안 됨
        // } else {
        //     this.state = 'connected';    // 이미 연결됨
        //     this.workspaceName = connectedInfo.workspaceName;
        //     this.botId = connectedInfo.botId;
        // }
    }
 
    formatPhoneNumber() {
        if (!this.phoneNumber) return;

        // 숫자만 남김
        let digits = this.phoneNumber.replace(/\D/g, '');

        // 최대 11자리 제한
        if (digits.length > 11) {
            digits = digits.slice(0, 11);
        }

        if (digits.length <= 3) {
            this.phoneNumber = digits;
        } else if (digits.length <= 7) {
            this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        } else {
            this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
        }
    }

    //const SB_USER_ID_KEY = 'sb_user_id';

        // export async function savePhoneNumber(phoneNumber: string): Promise<string> {
        // // 1️⃣ userId 확보
        // let userId = localStorage.getItem(SB_USER_ID_KEY);

        // if (!userId) {
        //     userId = uuidv4();
        //     localStorage.setItem(SB_USER_ID_KEY, userId);
        // }

        // // 2️⃣ Firestore 저장
        // await setDoc(
        //     doc(firestore, 'users', userId),
        //     {
        //     profile: {
        //         phoneNumber,
        //     },
        //     updatedAt: serverTimestamp(),
        //     createdAt: serverTimestamp(),
        //     },
        //     { merge: true }
        // );

        // return userId;
        // }

    connectNotion() {

        // 1. 임시 userId 생성 (state)
        const userId = crypto.randomUUID();

        // 2. 나중에 쓰기 위해 저장 (중요)
        localStorage.setItem("notion_user_id", userId);

        // 3. state를 query로 넘김
        window.location.href =
            `${this.config.functionsBaseUrl}/notionAuth?userId=${userId}`;
    }
}
  

