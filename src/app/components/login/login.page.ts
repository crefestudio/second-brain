import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FBAuthService, FBLoginProvider } from '../../services/fb-auth.service';
import { CFDateFormat, CFHelper, _log } from '../../lib/cf-common/cf-common';

@Component({
    selector: 'login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.css']
})
export class LoginPage implements OnInit, OnDestroy {
    
    // public mainWord: string = '';
    // public version: string = environment.version;
    // public updateCount: string = '';
    // public updateDate: string = environment.date;

    public redirectUrl: string = '';

    public isLogining: boolean = false;
    public isCustomLoginMessage: boolean = false;

    private _observerRouter: any;

    public email: string = '';
    public password: string = '';

    constructor(
        private authService: FBAuthService,
        private activateRouter: ActivatedRoute,
        private router: Router
        //private appStatisticsStore: AppStatisticsStore,
        //public appService: NotePlatformService,
        //private alertService: BLAlertService,
    ) {
        // let count = this.version.split('.');
        // this.updateCount = count[1];

        //_log('==>', appService);
        
        if(!this._observerRouter) {
            this._observerRouter = this.activateRouter.queryParams.subscribe(queryParams => {
                _log('LoginPage::queryParams =>', queryParams);
                if (queryParams['redirect_url']) {
                    this.redirectUrl = atob(queryParams['redirect_url']); // queryparam전달 안도서 base64로 엔코딩되엉 옴
                    _log('LoginPage::activateRouter redirectUrl =>', this.redirectUrl);
                    this.authService.redirectUrl = this.redirectUrl;
                }
                if (queryParams['state'] == 'ing') {
                    this.isLogining = true;
                } else {
                    this.isLogining = false;
                }
            });   
        }
    }

    ngOnInit(): void {
        //this.updateDate = this.getDatFormate(this.updateDate);
        //this.settingMainWord();
        // let config = this.appService.appBuildConfig;
        // this.isCustomLoginMessage = config.account && config.account.login && config.account.login.title.length > 0;
    }

    ngOnDestroy(): void {
        if (this._observerRouter) {
            this._observerRouter.unsubscribe();
        }
    }

    // settingMainWord() {
    //     let randowm = Math.floor(Math.random() * this.randomWord.length);
    //     this.mainWord = this.randomWord[randowm];
    // }

    getDatFormate(date: string = '') {
        return CFHelper.date.format(CFDateFormat.YYYY년MM월DD일, date);
    }

    // onClickLoginDesc() {
    //     this.alertService.show(
    //         '라이프로그랩 서비스는 지금 무료로 이용가능합니다.<br>이용하시려면, 아래의 <strong>구글로 시작하기</strong> <br>또는 <strong>애플로 시작하기</strong> 버튼을 눌러주세요.', '안내', '확인');
    // }

    onClickGoogleLogin() {
        _log('onClickGoogleLogin router.url =>', this.router.url);
        this.router.navigateByUrl(this.redirectUrl ? `${this.router.url}&state=ing` : `${this.router.url}?state=ing`);
        this.authService.login(FBLoginProvider.google, this.redirectUrl);
    }

    onClickAppleLogin() {
        this.router.navigateByUrl(this.redirectUrl ? `${this.router.url}&state=ing` : `${this.router.url}?state=ing`);
        this.authService.login(FBLoginProvider.apple, this.redirectUrl);
    }

    // onClickEmailLogin() {
    //     //let rect = {left: event.clientX + 30, top: event.clientY - 645, width: 1, height: 1 };
    //     this.email = '';
    //     this.password = '';
    //     this.createPageTemplatePopup.popup().then((resp) => {
    //         _log('onClickEmailLogin resp, email, passzword =>', resp, this.email, this.password );
    //         this.authService.loginWithEmail(this.email, this.password).then((result) => {
    //             if (!result) {
    //                 this.alertService.show('아이디 또는 패스워드를 잘못 입력했습니다. 입력하신 내용을 다시 확인해주세요.');
    //                 return;
    //             }
    //         })
    //     });
    // }


    // 게스트 로그인
    // onClickGuestLogin() {
    //     this.authService.loginWithEmail(AppSpecialUserAccount.guest[0].email, AppSpecialUserAccount.guest[0].password).then((result) => {

    //     });
    // }

    // onClickInquiryMenu(event: any) {
    //     let rect = {left: event.clientX + 30, top: event.clientY - 645, width: 1, height: 1 };
    //     this.inquiryPopup.popup(PopupDirection.up, PopupAlign.left, rect);
    // }    

    // onCancel() {
    //     BLPopupComponent.hideAll();
    // }

    // onClickDesktop() {
    //     let pwaInstallPrompt = this.appService.pwaInstallPrompt;
    //     if(!pwaInstallPrompt) { return; }
    //     pwaInstallPrompt.prompt();

    //     // Wait for the user to respond to the prompt
    //     pwaInstallPrompt.userChoice.then((result: any) => {
    //         // Reset the deferred prompt variable
    //         this.appService.pwaInstallPrompt = null;
    //     });
    // }

    /* -------------------------------------------------------------------------- */
    /*                                 #stage mode                                */
    /* -------------------------------------------------------------------------- */
    // stage 로그인
    // onClickChangeStage() {
    //     this.alertService.confirm('스테이지모드로 전환하시겠습니까?').then((result) => {
    //         const appStageUrl = this._convertToStageUrl(environment.frontAppURL);
    //         window.location.href = appStageUrl;
    //     });
    // }

    // onClickLoginStage() {
    //     this.authService.loginWithEmail(AppSpecialUserAccount.tester[0].email, AppSpecialUserAccount.tester[0].password).then((result) => {
    //         const appStageUrl = this._convertToStageUrl(environment.frontAppURL);
    //         window.location.href = appStageUrl;
    //     });
    // }

    // private _convertToStageUrl(url: string): string {
    //     const urlObj = new URL(url);
    //     // 호스트네임을 점(.)으로 분리하여 각 레이블로 만듭니다.
    //     const parts = urlObj.hostname.split('.');
       
    //     // 첫 번째 레이블이 "-stage"로 끝나지 않으면 붙입니다.
    //     if (!parts[0].endsWith('-stage')) {
    //         parts[0] += '-stage';
    //     }
       
    //     // 다시 호스트네임 조합
    //     const stageHostname = parts.join('.');
       
    //     // protocol, pathname, search를 그대로 사용하여 새 URL 생성
    //     return `${urlObj.protocol}//${stageHostname}${urlObj.pathname}${urlObj.search}`;
    // }

    // forceUserId: string = '';
    // isShowForceUserId: boolean = false;

    // onClickSetForceUserId() {
    //     this.isShowForceUserId = true;
    // }

    // onSaveToLocalStorage() {
    //     this.isShowForceUserId = false;
    //     let userId = this.forceUserId; //'sfWLi7adSYMFmWbXgd8Ra2IhwmQ2';
    //     this.authService.setForceUserId(userId);
    // }

}
