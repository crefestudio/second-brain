import { _log } from '../../../../../lib/cf-common/cf-common';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { UserService } from '../../../../../services/user.service';
import { ToastService } from '../../../../../services/toast.service';
import { AuthService } from '../../../../../services/auth.service';

//import { APP_CONFIG, AppConfig } from '../../../../../config/app-config.token';
import { NACommonService } from '../../../../../services/common.service';


const templateKey = 'lifeUp';

@Component({
    selector: 'app-agent-connect-component',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './agent-connect-component.component.html',
    styleUrl: './agent-connect-component.component.css'
})
export class AgentConnectComponentComponent implements OnInit {

    isLoading = true;

    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    // Purchaser check
    requestPurchaserCheck = false;
    isPurchaserVerifying = false;
    isRequestMailCheck = false;
    verifyValue = '';

    // kakao
    isRequestingKakaoCode = false;
    kakaoVerificationCode = '';

    public isRequestKakaoConnect = false;
    public isWaitingKakaoVerification = false;
    public isKakaoVerificationSuccess = false;
    isConfirmRemoveDisconnectKakao: boolean = false;

    // notion tempalte
    isOpenNotionConnectWindow: boolean = false; // 연결창 띄움 여부

    ///////////////////////////////////

    hasLifeupPurchase: boolean = false;

    showPurchaseDetail = false;
    showWorkspaceDetail = false;
    purchaseInfo: any = null;
    workspaceInfo: any = null;

    // 메일 인증
    isEmailSending: boolean = false;
    isVerifying: boolean = false;
    codeArray: string[] = ['', '', '', '', '', ''];

    errorMessage = '';
    warnMessage = '';

    // 템플릿 연결
    // private config = inject<AppConfig>(APP_CONFIG);
    // public isNotionIntegrated: boolean = false;

    constructor(private userService: UserService, private authService: AuthService) {

    }

    async ngOnInit() {
        try {
            await this.initData();

            this.userService.kakaoVerified$.subscribe(() => {
                this.onComplateKakaoConnect();
            });

            this.userService.notionConnected$.subscribe(() => {
                this.onComplateNotionTemplateConnect();
            });
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();
        await this.updatePurchaseInfo();
    }

    // 화면 아무 곳이나 클릭 시 닫힘
    @HostListener('document:click')
    closeAllOverlays() {
        this.cancelConfirm();
    }

    cancelConfirm() {
        this.isConfirmRemoveDisconnectKakao = false;
    }

    async updateSession() {
        await this.authService.updateSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log('updateSession memberUid, userId, notionAccessToken =>', this.memberUid, this.userId, this.kakaoUserId, this.notionAccessToken);

        if (!this.userId) {
            console.error('워크스페이스 로그인에 실패하였습니다.');
            this.errorMessage = '워크스페이스 로그인에 실패하였습니다.';
            return;
        }
    }

    get email(): string {
        return this.purchaseInfo?.email ?? '';
    }


    async submitVerification() {
        if (!this.userId) { return; }
        if (!this.verifyValue) return;

        this.isVerifying = true;
        const value = this.verifyValue.trim();

        if (!value) {
            this.errorMessage = '구매 시 등록한 이메일을 입력해주세요.';
            return;
        }

        let email: string | undefined;
        let phone: string | undefined;

        // 이메일 검사
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(value)) {
            email = value.toLowerCase();
        } else {
            // 전화번호 검사
            const digits = value.replace(/\D/g, '');

            if (digits.length === 11 && digits.startsWith('010')) {

                phone =
                    `${digits.substring(0, 3)}-` +
                    `${digits.substring(3, 7)}-` +
                    `${digits.substring(7, 11)}`;

            } else {
                this.errorMessage = '올바른 이메일을 입력해주세요.';
                return;
            }
        }

        try {
            const success = await this.userService.verifyPurchaser(this.userId, 'lifeUp', email, phone);
            if (!success) {
                this.errorMessage = '구매정보를 찾을 수 없습니다.';
                return;
            }

            this.updatePurchaseInfo();
            ToastService.show('구매 정보가 확인되었습니다.');

            this.requestPurchaserCheck = false;
        } catch (e) {
            console.error(e);
            this.errorMessage = '구매 확인 중 오류가 발생했습니다.';
        } finally {
            this.isVerifying = false;
        }
    }

    cancelVerification() {
        this.verifyValue = '';
        this.requestPurchaserCheck = false;
    }

    async removeLifeupPurchase(): Promise<void> {
        if (!this.userId || !this.purchaseInfo?.templateId) {
            return;
        }

        await UserService.deletePurchase(
            this.userId,
            this.purchaseInfo.templateId
        );

        this.purchaseInfo = null;
        this.hasLifeupPurchase = false;
    }

    async updatePurchaseInfo() {
        if (!this.userId) { return; }
        this.purchaseInfo = await UserService.getPurchaseInfo(this.userId, 'lifeUp');
        _log('updatePurchaseInfo purchaseInfo =>', this.purchaseInfo);
        this.hasLifeupPurchase = this.purchaseInfo != null;
        if (this.hasLifeupPurchase) {
            this.purchaseInfo = await UserService.getPurchaseInfo(this.userId, 'lifeUp');
        } else {
            this.purchaseInfo = null;
        }
    }

    onRequestMailCheck() {
        this.requestMailCheck();
    }

    //////////////////////////////////////////////////////////
    //    메일 인증 
    //

    cancelMailCheck(): void {
        this.isRequestMailCheck = false;
    }

    initStateData() {
        this.errorMessage = '';
        this.warnMessage = '';
        this.isVerifying = false;
        this.isEmailSending = false;
        this.codeArray = Array(6).fill('');
    }

    async requestMailCheck() {

        this.initStateData()

        this.isRequestMailCheck = true;
        this.isEmailSending = true;

        const email = this.email;
        if (!email) {
            this.errorMessage = '인증 이메일을 확인 할 수 없습니다. 관리자에게 문의 바랍니다.';
            return;
        }

        try {
            const isSuccess = await this.userService.sendVerificationEmail(email.toLowerCase().trim());

            if (!isSuccess) {
                this.errorMessage = '인증 메일 발송에 실패했습니다.';
                return;
            }
        } catch {

            this.errorMessage = '인증 메일 발송에 실패했습니다.';

        } finally {
            this.isEmailSending = false;
        }
    }

    ////////////////////////////////////////////////////////
    // 인증 숫자 6개
    onInputNumber(event: any, index: number) {
        const value = event.target.value;

        // 숫자만 허용
        if (/^[0-9]$/.test(value)) {
            this.codeArray[index] = value;

            // 다음 input으로 자동 포커스
            const nextInput = event.target.nextElementSibling;
            if (nextInput) {
                nextInput.focus();
            }
        } else {
            event.target.value = ''; // 숫자가 아니면 초기화
        }

        if (index == 5) {
            this.submitCertificationNumber();
        }
    }

    onBackspace(event: any, index: number) {
        _log('onBackspace index =>', index);
        if (index == 0) { return; }
        //if (!this.codeArray[index]) {
        const prevInput = event.target.previousElementSibling;
        if (prevInput) prevInput.focus();
        //} else {
        this.codeArray[index] = '';
        //}
    }

    getVerificationCode(): string {
        return this.codeArray.join('');
    }

    // 이메일 인증번호 확인
    // async submitCertificationNumber() {
    //     this.isVerifying = true;
    //     this.errorMessage = '';

    //     if (!this.email) { return; }
    //     const result: { userId: string, accessKey: string, message?: string } | null =
    //         await this.userService.verifyCode(this.email, this.getVerificationCode());

    //     _log('submitCertificationNumber result =>', result);
    //     if (result && result.userId && result.accessKey) {
    //         _log('메일 인증 성공!', result.userId);

    //         // 만약에 accessKey를 못받으면.
    //         if (result.userId && result.accessKey) {
    //             alert('test userId =>' + result.userId + ' accessKey =>' + result.accessKey);
    //             // 로컬 스토리지나 상태 관리에 저장
    //             // this.saveLocalSession(result.userId, { userId: result.userId, accessKey: result.accessKey });
    //             // // 세션 단계로 넘어감   
    //             // if (this.userId !== result.userId) {
    //             //     this.userId = result.userId;
    //             //     this.initStateData();
    //             //     this.clientUrl = 'https://app.notionable.net/secondbrain/widget/' + this.userId;
    //             //     this.state = 'change-client-url';
    //             // } else {
    //             //     await this.redoStateProc();
    //             // }
    //         } else {
    //             this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다. code = 132';
    //         }

    //     } else if (!result || result.message) {
    //         console.warn('인증 실패');
    //         this.initStateData();
    //         this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다.';
    //     }
    //     this.isVerifying = false;
    // }

    // 이메일 인증번호 확인
    async submitCertificationNumber() {
        this.errorMessage = '';
        this.warnMessage = '';
        this.isVerifying = true;
        if (!this.memberUid) {
            this.errorMessage = '권한이 없습니다. 로그인이 필요합니다.';
            return;
        }

        if (!this.email) {
            this.errorMessage = '인증 이메일을 확인 할 수 없습니다. 관리자에게 문의 바랍니다.';
            return;
        }
        const result: { userId: string, accessKey: string, message?: string } | null =
            await this.userService.verifyCode(this.email, this.getVerificationCode());

        _log('submitCertificationNumber result =>', result);
        if (result && result.userId && result.accessKey) {
            _log('메일 인증 성공!', result.userId);

            // 만약에 accessKey를 못받으면.
            if (result.userId && result.accessKey) {
                // 로컬 스토리지나 상태 관리에 저장
                UserService.saveLocalSession(result.userId, { userId: result.userId, accessKey: result.accessKey });

                if (this.memberUid) {
                    await UserService.saveImwebMemberId(
                        result.userId,
                        this.memberUid
                    );
                }

                this.userId = result.userId;

                // 세션 단계로 넘어감   
                // if (this.userId !== result.userId) {
                //     this.userId = result.userId;
                //     this.initStateData();
                //     this.clientUrl = 'https://app.notionable.net/secondbrain/widget/' + this.userId;
                //     this.state = 'change-client-url';
                // } else {
                //     await this.redoStateProc();
                // }
            } else {
                this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다. code = 132';
            }

        } else if (!result || result.message) {
            console.warn('인증 실패');
            this.initStateData();
            this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다.';
        }
        this.isVerifying = false;
    }

    /////////////////////////////////////////////////
    // kakao

    onRequestConnetKakao() {
        this.isRequestKakaoConnect = true;
        this.requestConnetKakao();
    }

    async requestConnetKakao() {
        if (!this.userId) {
            ToastService.error('사용자 정보를 찾을 수 없습니다.');
            return;
        }

        this.isRequestingKakaoCode = true;
        try {
            const result = await this.userService.requestKakaoVerification(this.userId);
            this.isRequestingKakaoCode = false;
            if (!result) {
                ToastService.error('인증번호 생성에 실패했습니다.');
                return;
            }
            this.kakaoVerificationCode = result.code;
            this.isRequestKakaoConnect = true;

            ToastService.show('인증번호가 생성되었습니다.');
        } catch (e) {
            console.error(e);
            ToastService.error('카카오 연결 준비 중 오류가 발생했습니다.');
        }
    }

    cancelKakaoVerification() {
        this.isRequestKakaoConnect = false;
        this.isWaitingKakaoVerification = false;
        this.isKakaoVerificationSuccess = false;
        this.kakaoVerificationCode = '';
        this.userService.stopVerificationWatcher();
    }

    async copyKakaoVerificationCode() {
        if (!this.kakaoVerificationCode) return;
        await navigator.clipboard.writeText(this.kakaoVerificationCode);
        ToastService.show('인증번호가 복사되었습니다.');
    }

    openKakaoChat() {
        if (!this.userId) {
            ToastService.error('사용자 정보를 찾을 수 없습니다.');
            return;
        }

        this.isWaitingKakaoVerification = true;
        window.open(
            'http://pf.kakao.com/_xktkXX/chat',
            '_blank'
        );
        this.userService.startVerificationWatcher(this.userId);
    }

    onComplateKakaoConnect() {
        this.isWaitingKakaoVerification = false;
        this.isKakaoVerificationSuccess = true;
        this.isRequestKakaoConnect = false;

        ToastService.show(
            '카카오 연결이 완료되었습니다.'
        );
        this.updateSession();
    }

    onClickDisconnectKakaoBtn() {
        // 컨펌창 띄우기
        setTimeout(() => {
            this.isConfirmRemoveDisconnectKakao = true;
        }, 10)
    }

    async disconectKakao() {

        // 컨펌창 닫기
        this.isConfirmRemoveDisconnectKakao = false;

        const result = await this.userService.disconnectKakao(this.userId);
        if (result) {
            ToastService.show('카카오톡 연결을 해제 하였습니다.');
        } else {
            ToastService.error('카카오톡 연결 해제에 실패하였습니다.');
        }
        this.updateSession();
    }

    ///////////////////////////////////////////////////////////////
    //
    // notion tempate 연결

    onClickConnectTemplate() {
        this.isOpenNotionConnectWindow = true;
        this.userService.startNotionConnectWatcher(this.userId);
        this.openNotionConnectWindow();
    }

    onClickCancelConnectTemplateBtn() {
        this.isOpenNotionConnectWindow = false;
        this.userService.stopNotionConnectWatcher();
    }

    async openNotionConnectWindow() {
        _log('connectTemplate userId =>', this.userId);
        if (!this.userId) { return; }

        const encryptedUserId = await NACommonService.encrypt(this.userId); // 암호화해서 userId를 넘긴다.
        const baseUrl = window.location.origin;
        const serviceName = 'notion-auth';
        const setupPath = 'connect';
        const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;
        window.open(url, '_blank');
        return;
    }

    onComplateNotionTemplateConnect() {
        this.isOpenNotionConnectWindow = false;
        ToastService.show(
            '노션 템플릿 연결이 완료되었습니다.'
        );
        this.updateSession();
    }

    async onClickDisconnectNotionTemplate() {
        const result = await this.userService.disconnectNotionTemplate( this.userId);
        this.updateSession();

        if (result) {
            ToastService.show(
                '노션 템플릿 연결을 해제하였습니다.'
            );

            this.notionAccessToken = '';
        } else {
            ToastService.error(
                '노션 템플릿 연결 해제에 실패하였습니다.'
            );
        }
    }

}
