import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';
import { NotionService } from '../../../services/notion.service';
import { UserService } from '../../../services/user.service';
import { NACommonService } from '../../../services/common.service';
import { _log } from '../../../lib/cf-common/cf-common';

@Component({
    selector: 'app-connect',
    standalone: true,  
    templateUrl: './secondbrain.connect.component.html',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./secondbrain.connect.component.css']
})
export class SecondBrainConnectComponent implements OnInit {
    //private userService = inject(UserService);
    
    state: string = ''; // notjoin, notconnected, connected
    //phoneNumber: string = '';
    //databaseData: any;
    private config = inject<AppConfig>(APP_CONFIG);
    activeTab: 'installed' | 'not-installed' = 'installed';

    //
    userId: string = '';
    // workspaceName: string = '';
    // botId: string = '';

   selectTab(tab: 'installed' | 'not-installed') {
        this.activeTab = tab;
    }
 
    constructor(private notionService: NotionService, private userService: UserService) { 

    }

    ngOnInit() {
        this.connectProc();
    }

    async connectProc() {
        // URL에서 token 혹은 query param으로 전화번호 가져오기
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (!token) return;
        let userId = await NACommonService.decrypt(token);
        if (!userId) {
            _log('connectProc userId =>', userId); 
            this.state = 'notjoin';
            return;
        }
        this.userId = userId;
        
        // 구매자 체크 : 구매자 확인은 직접 연동이 안되기 때문에 후처리하기로 함
        //let isPurchaser: boolean = await this.checkPurchaser(phoneNumber);        
        
        // if (!isPurchaser) { this.state = 'notpurchaser'; // 비구매자 r
        // return; 
        // }

        // let userInfo: { userId: '', interations: {} } = await this.userService.getUserInfoByPhoneNumber(phoneNumber);
        // _log('userInfo =>', userInfo);

        // if (userInfo && userInfo.userId) {
        //     this.userId = userInfo.userId;
        // }
        // if (!userInfo || !userInfo.userId) {
        //     this.state = 'notjoin'; 
        //     await this.joinMmeber(phoneNumber); // userId : phoneNumber 매칭
        // } else if (userInfo.interations) {                
        //     // 이미 연결
        //     this.state = 'connected';
        // } else {
        //     // 처음 연결
        //     this.state = 'notconnected';
        // }
        // } else {
        //     this.state = 'notpurchaser'; // 비구매자
        // }

        const data: any = await UserService.getSecondBrainIntegration(userId);
        _log('connectProc secondbrain userId, data =>', userId, data);

        if (!data) {
            this.state = 'notconnected';
            return;
        }

        if (data.accessToken) {
            this.state = 'connected';
        } else {
            this.state = 'notconnected';
        }

        _log('loginProc state =>', this.state);
    }

    async connectNotion() {
        _log('connectNotion state, userId =>', this.state, this.userId);
        let userId = '';
        if (this.userId) {
            userId = this.userId;
        } else if (this.state == 'notjoin') {
            alert('오류 - 아직 계정이 만들어지지 않았습니다.');            
        } else {
            alert('오류 - userId없음');
        }

        // 3. state를 query로 넘김
        window.location.href = `${this.config.functionsBaseUrl}/notionAuth?userId=${userId}`;
    }


    // notpurchaser -> notjoin -> notconnected -> connected

    // async checkPurchaser(phoneNumber: string) {
    //     // 1️⃣ 복호화 함수 필요 (앞에서 만든 encrypt/복호화)
    //     let isPremiumPurchaser = await this.userService.isPremiumPurchaser(phoneNumber)

    //     if (isPremiumPurchaser) {
    //         alert(
    //             '구매 인증이 처리되었습니다.\n' +
    //             'API연동 작업을 계혹 진행합니다.'
    //         );
    //     } else {
    //         // alert(
    //         //     '죄송합니다. 해당 전화번호로 구매자를 확인할 수 없습니다.\n' +
    //         //     '문의: toto791@gmail.com'
    //         // );
    //         return false;
    //     }
    //     return true;        
    // }




    // const phone = '010-1234-5678';
    // const integration = await userService.getIntegrationByPhone(phone);
    // if (!integration) {
    // alert('해당 번호로 연결된 정보가 없습니다.');
    // } else {
    // console.log('연결 정보:', integration);
    // }

    // async onConfirm() {
    //     if (!this.phoneNumber) return;

    //     try {
    //         await UserService.savePhoneNumber(this.phoneNumber); 
    //     } catch (e) {
    //         console.error('저장 실패', e);
    //     }
    // }

    // async onConfirm() {
        // if (!this.phoneNumber) return;

        // // 1. 전화번호 형식 검증
        // const isValid = /^010-\d{4}-\d{4}$/.test(this.phoneNumber);
        // if (!isValid) {
        //     alert('전화번호 형식은 010-0000-0000 입니다.');
        //     return;
        // }

        // try {
        //     /**
        //      * 2. 구매자 검증
        //      * - 서버(Firebase Function)에서
        //      *   → 해당 전화번호가 LifeUp 템플릿 구매자인지 확인
        //      * - true: 통과
        //      * - false: 차단
        //      */
        //     // const isBuyer = await UserService.verifyBuyerPhone(this.phoneNumber);
        //     // if (!isBuyer) {
        //     //     alert('정식 구매자만 이용할 수 있는 서비스입니다.');
        //     //     return;
        //     // }

        //     /**
        //      * 3. 이미 등록된 유저인지 확인
        //      * - 등록된 경우: 로그인 처리
        //      * - 없으면: 신규 user 생성
        //      */
        //     const userId = '11'; //await this.userService.checkPhoneExists(this.phoneNumber);

        //     if (userId) {
        //         // 기존 유저
        //         this.userId = userId;
        //         this.state = 'logined';
        //         console.log('이미 등록된 사용자', userId);
        //     } else {
        //         // 신규 유저 생성 → userId 반환받기
        //         const newUserId = await UserService.savePhoneNumber(this.phoneNumber);
        //         this.userId = newUserId;
        //         this.state = 'logined';
        //     }

        // } catch (e) {
        //     console.error('저장 실패', e);
        //     alert('저장 중 오류가 발생했습니다.');
        //     return;
        // }

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
    //}
 
    // formatPhoneNumber() {
    //     if (!this.phoneNumber) return;

    //     // 숫자만 남김
    //     let digits = this.phoneNumber.replace(/\D/g, '');

    //     // 최대 11자리 제한
    //     if (digits.length > 11) {
    //         digits = digits.slice(0, 11);
    //     }

    //     if (digits.length <= 3) {
    //         this.phoneNumber = digits;
    //     } else if (digits.length <= 7) {
    //         this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    //     } else {
    //         this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    //     }
    // }    

    // async joinMmeber(phoneNumber: string) {
    //     // 여기서는 이미 전화번호확인이 끝난상태에서 호출함
    //     if (!phoneNumber) { return; } 
    //     this. userId = await UserService.memberJoinWIthPhoneNumber(phoneNumber);
    //     _log('joinMmeber userId =>', this.userId);
    //     if(this.userId) {
    //         this.state = 'notconnected'; // 가입은 되었으나 연결이 되지 않은 상태
    //     }
    // }
}
  

