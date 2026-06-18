import { _log } from '../../../../lib/cf-common/cf-common';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../services/user.service';
import { ToastService } from '../../../../services/toast.service';
import { AuthService } from '../../../../services/auth.service';

const templateKey = 'lifeUp';

@Component({
    selector: 'app-agent-connect-component',
    imports: [CommonModule, FormsModule],
    templateUrl: './agent-connect-component.component.html',
    styleUrl: './agent-connect-component.component.css'
})
export class AgentConnectComponentComponent implements OnInit {

    requestPurchaserCheck = false;
    isRequestMailCheck = false;
    verifyValue = '';

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

    memberUid: string = '';
    userId: string = '';

    constructor(private userService: UserService, private authService: AuthService) {

        // userId
    }

    ngOnInit() {
        this.loadSession();
        this.updatePurchaseInfo();
        this.updateWorkspaceInfo();
    }

    async loadSession() {
        await this.authService.loadSession();
        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();

        if (!this.userId) {
            console.error('사용자를 찾을 수 없습니다.');
            this.errorMessage = '사용자를 찾을 수 없습니다.';
            return;
        }
    }

    get email(): string {
        return this.purchaseInfo?.email ?? '';
    }


    async submitVerification() {
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
            const success = await this.userService.verifyPurchaser('lifeUp', email, phone);
            if (!success) {
                this.errorMessage = '구매정보를 찾을 수 없습니다.';
                return;
            }

            this.updatePurchaseInfo();
            this.updateWorkspaceInfo();
            ToastService.show('구매 정보가 확인되었습니다.');

            this.requestPurchaserCheck = false;
        } catch (e) {
            console.error(e);
            this.errorMessage = '구매 확인 중 오류가 발생했습니다.';
        }
    }

    cancelVerification() {
        this.verifyValue = '';
        this.requestPurchaserCheck = false;
    }

    removeLifeupPurchase(): void {
        const purchases = JSON.parse(
            localStorage.getItem('notionable_verified_purchases') || '{}'
        );

        delete purchases['lifeUp'];

        localStorage.setItem(
            'notionable_verified_purchases',
            JSON.stringify(purchases)
        );

        this.hasLifeupPurchase = false;
        this.purchaseInfo = '';
        this.workspaceInfo = '';
    }

    updatePurchaseInfo() {
        this.hasLifeupPurchase = UserService.isPurchased('lifeUp');

        if (this.hasLifeupPurchase) {
            this.purchaseInfo = UserService.getPurchaseInfo('lifeUp');
        } else {
            this.purchaseInfo = null;
        }
    }

    updateWorkspaceInfo() {
        
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

    onResendCertificationCode() {

    }

    onSubmitCertificationNumber() {

    }
}
