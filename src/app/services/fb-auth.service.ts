import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { _flog, _log, _valid } from '../lib/cf-common/cf-common';

// firebase
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup, reauthenticateWithRedirect,
     signInWithRedirect, getRedirectResult, OAuthProvider, signInWithEmailAndPassword, 
     setPersistence,
     browserLocalPersistence} from "firebase/auth";
import { getFunctions, httpsCallable } from 'firebase/functions';

// import { BLAlertService } from '../lib/bl-ui/service/bl-alert.service'; 
import { AppMember, MemberStore, PurchaseData } from '../stores/member.store';
import { AppSpecialUser } from '../note-platform.config'; 
import { FBFunctionsRegion } from './fb-functions.service'; 

export enum FBLoginProvider {
    google = 'google',
    apple = 'apple'
}


// const DEMO_PASSWORD: string = 'blank3651122#';

// const DEMO_USERS: Array<any> = [{
//     "uid": "aDONcinSJPZM5FpdT78qiuDyGBj1",
//     "email": "toto.blank365@gmail.com",
//     "displayName": "LIFELOGLAB 관리자",
//     "photoURL": "https://lh3.googleusercontent.com/a/ACg8ocK0O8iFXjFrv4_8Gc7gv_RzV-Vpjg_tnQ54J26_8wer=s96-c",
//     "providerData": [
//         {
//             "providerId": "google.com",
//         }
//     ],
// }]


// export interface IMember {
//     userId: string,
//     email: string,
//     displayName: string,
//     photoURL: string
// }

@Injectable()
export class FBAuthService {
   // private _provider: any;
    //private _app: any;
    private _auth: any;
    private _user: any | undefined;
    private _credential: any;
    private _uid: string = '';

    private _member?: AppMember;

    public redirectUrl = '';
    private _loginStateChangeListener: any; // isLogin, uid, isJoin 
    
    public isMobileDevice: boolean = false; // 이거는  popup로그인이냐 redirect로그인이냐의 판단으로 viewMode가 아닌 장치를 따라야 한다.

    public appId: string = '';

    public forceUserId: string = '';//'1AP1uJsyLPMs0H7OEeVbnowSApw2';
    
    //private 
    constructor(
        public router: Router, 
        //private alertService: BLAlertService,
        private memberStore: MemberStore,
    ) {
        _log('FBAuthService::constructor')
        //this._app = initializeApp(firebaseConfig);
        // 언어 설정
        this._auth = getAuth();
        this._auth.languageCode = 'kr';
        ////////////////////////////////
        this._listenState();
    }

    setForceUserId(userId: string) {
        this.forceUserId = userId;
        localStorage.setItem('forceUserId', this.forceUserId);
    }

    private _listenState() {
        if(!_valid(this._auth)) { return; }

        if (this._auth.currentUser) {
            _log("login::이미 로그인된 사용자:", this._auth.currentUser);
        } else {
            _log("login::로그인 정보 없음");
        }

        ////////////////////////////////
        // 로그인 유지
        setPersistence(this._auth, browserLocalPersistence) // 또는 sessionStorage 사용 가능
        .then(() => {
            _log("login::로그인 상태 유지");
        })
        .catch((error) => {
            _log("login::로그인 상태 유지 실패:", error);
        });

        onAuthStateChanged(this._auth, (user: any) => {
            _log('login::onAuthStateChanged user =>', user);
            if (user) {
                this._onLoginResultProcess(user);
            } else {
                 this._onLogoutResultProcess();
            }
        });

        getRedirectResult(this._auth).then((result: any) => {
            _log('getRedirectResult result =>', result);
            if(!result) {
                return;
            }
            const credential = OAuthProvider.credentialFromResult(result);
            _log('getRedirectResult credential =>', credential);
            this._credential = credential;
            // if (credential) {
            //     const accessToken = credential.accessToken;
            //     const idToken = credential.idToken;
            // }
            // _log('getRedirectResult result =>', result);
            // if (result && result.user) {
            //     this._onLoginResultProcess(result.user);
            // }
        })
        .catch((error) => {
            _log('getRedirectResult error =>', error);
            this._onLogoutResultProcess();
            // const errorCode = error.code;
            // // Handle Errors here.
            // const errorMessage = error.message;
            // let el = window.document.getElementById('patch-message');
            // if (el) {
            //     el.innerText = errorMessage
            // }
            // The email of the user's account used.
            //const email = error.customData.email;
            // The credential that was used.
            //const credential = OAuthProvider.credentialFromError(error);
            //window.document.body.innerHTML = errorMessage;
            // ...
        });
    }

    // 결과가 둘다 온다. 2개의 이벤트에서 , this.redirectUrl은 빈 값이다. login페이지에서는 받았지만 넘겨 받지 못함 

    private async _onLoginResultProcess(user: any) {
        _flog(this._onLoginResultProcess, arguments);

        localStorage.setItem('loginedUser', JSON.stringify(user));
        
        _valid(user);
        if (!user) return;

        _log('_onLoginResultProcess forceUserId =>', this.forceUserId);

        // 강제로 id지정
        let forceUserId: string = localStorage.getItem('forceUserId') ?? this.forceUserId;
        if (forceUserId) {
            user.uid = forceUserId;
            localStorage.removeItem('forceUserId');
        }

        this._user = user;
        this._uid = user.uid;
        

        // 사용자가 로그인한 상태
        _log('_onLoginResultProcess2::사용자가 로그인했습니다. user, router.url, redirectUrl, _credential =>', user, this.router.url, this.redirectUrl, this._credential);
        
        // member : 회원가입 / 이미 회원이면 그냥 패스
        this._member = await this.memberStore.get(user.uid);
        _log('_joinMember _member =>', this._member);
        let isJoinMember: boolean = false;
        if(!this._member) { 
            this._member = await this._joinMember(user);
            isJoinMember = true;
        }
        let member: AppMember | undefined = this._member;

        // 모바일에서 삭제하면 로그인하고 여기로 다시 들어온다.
        if (member && member.isDelete) {
            // this.alertService.confirm('회원탈퇴 하시겠습니까?', '알림', '탈퇴').then(() => {
            //     this._realDeleteUserAccount();
            // }, () => {
            //     this._cancelRealDeleteUserAccount();
            // });
        } 

    
        if(this.redirectUrl) {  
            this.router.navigateByUrl(this.redirectUrl);
        } else {
            // 로그인 페이지만 메인으로 가고 이미 메인에 로그인 된 경우는 그냥 있어야 함, 안그럼 자꾸 로그인 홈으로 가는 버그 생김
            if (this.router.url.substring(0, 14) == '/account/login') {
                this.router.navigateByUrl('/main')
            }
        }

        // 커스텀키 생성
        let token = await this._createUserCustomToken(this._uid);

        // user 로그인 날짜 갱신
        if(member)  {
            this.memberStore.updateLastLoginDate(member, this.appId);
        }

        // event fire
        if (this._loginStateChangeListener) {
            this._loginStateChangeListener(true, user.uid, isJoinMember, token);
        }
    }

    // 로그아웃 했을 때 발생하는 이벤트
    private _onLogoutResultProcess() {
        localStorage.removeItem('loginedUser');
        localStorage.removeItem('forceUserId');

        // 사용자가 로그아웃한 상태
        _log('_onLogoutResultProcess 사용자가 로그아웃했습니다.');
        this._user = null;
        this._uid = '';
        this._member = undefined;

        this.router.navigate(['/account/login']);

        // fire event
        if (this._loginStateChangeListener) {
            this._loginStateChangeListener(false, null);
        }
    }

    // 회원가입 / 이미 회원이면 그냥 패스
    private async _joinMember(user: any): Promise<AppMember | undefined> {
        _flog(this._joinMember, arguments);
        // this._member = await this.memberStore.get(user.uid);
        // _log('_joinMember _member =>', this._member);
        // if(this._member) { return this._member; }

        // display name
        let displayName: string;
        if(!user.displayName) {
            displayName = "이름없음";
        } else {
            displayName = user.displayName;
        }
        this._member = await this.memberStore.create(user.uid, user.email, displayName, user.photoURL, this.appId);
        //this.alertService.toast('회원가입이 되었습니다.');

        // 회원가입 이벤트를 보낸다.
        // if (this._loginStateChangeListener) {
        //     this._loginStateChangeListener(true, this._uid, true);
        // }
        return this._member;
    }

    on(cbFunc: any) {
        _log('auth:on')
        this._loginStateChangeListener = cbFunc;
    }

    async loginWithEmail(email: string, password: string) {
        _flog(this.loginWithEmail, arguments)
        try {
            let userCredential = await signInWithEmailAndPassword(this._auth, email, password);
            // Signed in 
            // const user = userCredential.user;
            // this._onLoginResultProcess(user);
            return true;
        } catch(error: any) {
            _log('loginWithEmail error =>', error);
            // const errorCode = error.code;
            // const errorMessage = error.message;
            // alert(errorMessage)
            // this._onLogoutResultProcess();
            return false;
        }

        // if (password !== DEMO_PASSWORD) {
        //     return false;
        // }
        // let user = DEMO_USERS.find(item => item.email == email);
        // if (!user) {
        //     return false;
        // }
        // return this._onLoginResultProcess(user);
    }   

    async login(provider: FBLoginProvider, redirectUrl?: string) {
        _flog(this.login, arguments);
        if (redirectUrl) {
            this.redirectUrl = redirectUrl;
        }
        if(!_valid(this._auth)) { return; }
        let result;
        try {
            if(provider == FBLoginProvider.google) {
                let _provider = new GoogleAuthProvider();
                // 개정 선택창을 강제로 넣는다.
                _provider.setCustomParameters({
                    prompt: 'select_account'
                });
                _log('fb-auth apple login google provider =>', provider);
                if (this.isMobileDevice) {
                    result = await signInWithRedirect(this._auth, _provider);
                } else {
                    result = await signInWithPopup(this._auth, _provider);
                }
                // This gives you a Google Access Token. You can use it to access the Google API.
                this._credential = GoogleAuthProvider.credentialFromResult(result);
                _log('login google _credential =>', this._credential);
                if (this._credential) {
                    //const token = this._credential.accessToken;
                    //_log('fb-auth google login result =>', result);
                    // The signed-in user info.
                    // const user = result.user;
                    // IdP data available using getAdditionalUserInfo(result)
                    // ...
                    //this.alertService.toast('로그인 되었습니다.');
                }
            } else if (provider == FBLoginProvider.apple) {
                let provider = new OAuthProvider('apple.com');
                provider.addScope('email');
                provider.addScope('name');
                _log('fb-auth apple login provider =>', provider, this._auth);
                if (this.isMobileDevice) {
                    result = await signInWithRedirect(this._auth, provider);
                } else {
                    result = await signInWithPopup(this._auth, provider);
                }
                this._credential = OAuthProvider.credentialFromResult(result);
                _log('login apple _credential =>', this._credential);
                _log('fb-auth apple login credential =>', this._credential);
                _log('fb-auth apple login result =>', result);
            }
        } catch (error: any) {
            // Handle Errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            _log('fb-auth apple login errorCode, errorMessage =>', errorCode, errorMessage);
            // The email of the user's account used.
            const email = error.customData.email;
                // The AuthCredential type that was used.
            const credential = GoogleAuthProvider.credentialFromError(error);
        }
        return result;
    }

    // private async _getCurrentUser() {
    //     return new Promise((resolve, reject) => {
    //         if(!_valid(this._auth)) { return; }
    //         const unsubscribe = this._auth.onAuthStateChanged((user: any) => {
    //             unsubscribe(); // 이벤트 리스너 해제
    //             if (user) {
    //                 // 사용자가 로그인한 상태
    //                 console.log('사용자가 로그인했습니다.2');
    //                 console.log('사용자 정보2:', user);
    //                 resolve(user);
    //             } else {
    //                 // 사용자가 로그아웃한 상태
    //                 resolve(null);
    //                 console.log('사용자가 로그아웃했습니다.2');
    //             }
    //         }, reject);
    //     });
    // };

    async logout() {
        if(!_valid(this._auth)) { return; }
        await signOut(this._auth);
        //this.alertService.toast('로그아웃 되었습니다.');
    }

    // 로그인 되어 있으면 user, 아니면 null을 return
    // async getUser() {
    //     return new Promise((resolve, reject) => {
    //         if (this._auth.currentUser) {
    //             resolve(this._auth.currentUser);
    //         } else {
    //             const timers: any[] = []; // 타이머 ID 저장용 배열
    //             let resolved = false; 
    //             for (let delay of [10, 20, 30, 40, 50, 100, 300, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]) {
    //                 const timerId = setTimeout(() => {
    //                     if (resolved) return; 
    //                     _log('login::getUser delay, this._auth.currentUser =>', delay, this._auth.currentUser);
    //                     if (this._auth.currentUser) {
    //                         _log('login::getUser:success delay, this._auth.currentUser =>', delay, this._auth.currentUser);
    //                         resolved = true;
    //                         for (let id of timers) {
    //                             clearTimeout(id);
    //                         }
    //                         resolve(this._auth.currentUser);
    //                     }
    //                 }, delay);
    //                 timers.push(timerId); // 타이머 ID 저장
    //             }
    //         } 
    //     });
    // }

    async getSafeUser(): Promise<any> {
        //_log('getSafeUser _user =>', this._user);
        if (this._user) { return this._user; } // 있으면 주고

        let user: any = await this._getUserAsync();
        if (!_valid(user)) { throw new Error(); }
        //_log('getSafeUser user =>', user);
        return user;
    }

    async getSafeUserId() {
        let user = await this.getSafeUser();
        return user.uid;
    }

    private async _getUserAsync() {
        return new Promise((resolve, reject) => {
            if(!_valid(this._auth)) { return; }
            const unsubscribe = this._auth.onAuthStateChanged((user: any) => {
                unsubscribe(); // 이벤트 리스너 해제
                if (user) {
                    _log('login::getUserAsync user =>', user);
                    // 강제로 id지정
                    if (this.forceUserId) {
                        user.uid = this.forceUserId;
                    }

                    this._user = user;
                    this._uid = user.uid; 
                    resolve(user);
                } else {
                    this._user = '';
                    this._uid = ''; 
                    _log('login::getUserAsync user null');
                    resolve(null);
                }
            }, reject);
        });
    };

    // localhost cache
    // 불일치 시 이후 실제 로그인이 된 후 바로 잡힘 
    // 이후 로그인 실패 시 문제가 안될 때 사용
    getCacheUser() {
        if (this._user && this._uid) { return this._user; }
        const user: any = JSON.parse(localStorage.getItem('loginedUser') || 'null');
        _log('getCacheUser user =>', user);
        // 강제로 id지정
        if (this.forceUserId) {
            user.uid = this.forceUserId;
        }
        // if (user) {
        //     this._user = user;
        //     this._uid = user.uid; 
        // }
        return user ? user : null;
    }

    // 로그인 했을때만 userId를 return 아니면 오류
    getUserIdSnapshot() {
        return this._uid; //? this._uid : this.getUser();
    }

    getUserEmail() {
        return this._user? this._user.email : '';
    }
    
    isAdmin() {
        return AppSpecialUser.admin.includes(this._user.email);
    }

    isDeveloper() {
        return AppSpecialUser.developer.includes(this._user?.email);
    }

    // async awaitCheckLogined(): Promise<boolean> {
    //     let user: any = await this.getUser();
    //     return user? true: false;
    // }

    async deleteUserAccount() {
        if(!_valid(this._auth)) { return; }
        if(!_valid(this._user)) { return; }
        if(!this._member) { return; }
        _log('deleteUserAccount1 user, _member, redirectUrl =>', this._user, this._member, this.redirectUrl);
        _log('deleteUserAccount1 this._credential =>', this._credential);

        try {
            // 회원탈퇴를 하려면 권한문제 때문에 재로그인 해야 함
            let providerId: FBLoginProvider | undefined; 
            if (this._user.providerData[0].providerId == 'google.com') {
                providerId = FBLoginProvider.google;
            } else if (this._user.providerData[0].providerId == 'apple.com') {
                providerId = FBLoginProvider.apple;
            }
            _valid(providerId);

            // this.alertService.show('회원 탈퇴를 위한 추가 권한이 필요하여 다시 로그인을 진행합니다.').then(() => {
            //     if (!providerId) { return; }
            //     this._deleteUserAccount(providerId);
            // });
            
        }
        catch(error: any) {
            //this.alertService.toast('회원탈퇴 중 오류가 발생했습니다'+ error.message);
            if (this._member) {
                this.memberStore.deleteFlag(this._member, false); // 복원
                window.location.href = 'main';
            }
            _log('deleteUserAccount error =>', error);
        }        
    };

    // 회원탈퇴
    private async _deleteUserAccount(providerId: FBLoginProvider) {
        if(!this._member) { return; }
        try {
            //await this.login(providerId);
            //await reauthenticateWithCredential(this._user, this._credential);
            let _provider: any;
            if(providerId == FBLoginProvider.google) {
                _provider = new GoogleAuthProvider();
            } else if(providerId == FBLoginProvider.apple) {
                _provider = new OAuthProvider('apple.com');
            }
            if (this.isMobileDevice) {
                await this.memberStore.deleteFlag(this._member, true);    // 실제 삭제가 아니라 삭제 대상이 됨
                await reauthenticateWithRedirect(this._user, _provider);
                return;
            } else {  
                await reauthenticateWithPopup(this._user, _provider);
            }
            await this._realDeleteUserAccount(); // 삭제 계정 삭제         
        } catch(error: any) {
            this.alertService.toast('회원탈퇴 중 오류가 발생했습니다'+ error.message);
            if (this._member) {
                this.memberStore.deleteFlag(this._member, false); // 복원
                window.location.href = 'main';
            }
            _log('_deleteUserAccount error =>', error);
        }     
    }

    // 실제 계정의 삭제 
    private async _realDeleteUserAccount() {
        _valid(this._member);
        if(!this._member) { return; }
        await this.memberStore.delete(this._member);
        await deleteUser(this._user);
        this.alertService.toast('회원탈퇴가 완료되었습니다.');
    }

    private async _cancelRealDeleteUserAccount() {
        if (this._member) {
            await this.memberStore.deleteFlag(this._member, false); // 복원
            window.location.href = 'main';
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                                 #AppMember                                 */
    /* -------------------------------------------------------------------------- */
    async getSafeMember() {
        let _userId = await this.getSafeUserId();
        if (!this._member) {
            this._member = await this.memberStore.get(_userId);
        }
        _valid(this._member);
        return this._member;
    }

    async getOtherMember(userId: string) {
        return this.memberStore.get(userId);
    }

    getMemberSnapshot() {
        return this._member;
    }

    // // 초기에 isPremiumMember 하는데가 많음 // 로그인 전에 이 값을 미리 주고..
    // getMemberLocalCache(userId: string): AppMember | undefined {
    //     if (this._member) { return this._member; }
        
    //     const member: any = JSON.parse(localStorage.getItem(`member-${userId}`) || 'null');
    //     _log('getMemberLocalCache member =>', member);
    //     _valid(member);
    //     return member;
    // }

    async updateMember() {
        let userId = this.getUserIdSnapshot();
        _valid(userId);
        if (!userId) { return undefined; }
        this._member = await this.memberStore.get(userId);
        return this._member;
    }
    
    setMember(member: AppMember) {
        this._member = member;
    }
    
    getMemberNameSnapshot() {
        _valid(this._member && this._member.displayName && this._member.displayName.length > 0);
        return this._member ? this._member.displayName : '';
    }

    // async updateToPremiumMember(member: AppMember, appId: string, purchaseData: PurchaseData) {
    //     // _flog(this.updateToPremiumMember, arguments);
    //     // memberupdateToPremiumMember
    //     // // isPremiumMember를 true로 넣어준다.
    //     // if (!member.isPremiumMember) {
    //     //     member.isPremiumMember = {};
    //     // }
    //     // member.isPremiumMember[appId] = true;

    //     // // purchaseData를 넣어준다.
    //     // if (purchaseData && purchaseData.productId) {
    //     //     if (!member.purchaseData) {
    //     //         member.purchaseData = {};
    //     //     }
    //     //     member.purchaseData[purchaseData.productId] = purchaseData;
    //     // }

    //     return this.updateMember(member);
    // }

    async updateCurrentMember(member: AppMember, isSaveDB: boolean = true) {
        _flog(this.updateCurrentMember, arguments);
        let _member;
        if (isSaveDB) {
            _member = await this.memberStore.update(member);
        }
        if(_member) {
            this._member = _member;
        } else {
            this._member = member;
        }
        return this._member;
    }

    /* -------------------------------------------------------------------------- */
    // 현재 로그인 한 user의 uid를 기반으로 customToken을 생성한다.
    // async _createUserCustomToken(userId: string) {
    //     _log('_createUserCustomToken userId =>', userId);

    //     const functions = getFunctions(this._app, FBFunctionsRegion); 
    //     const fncCreateUserCustomToken = httpsCallable(functions, 'createUserCustomToken');
    //     _log('_createUserCustomToken fncCreateUserCustomToken =>', fncCreateUserCustomToken);
    //     let token = '';
    //     try {
    //         let result = await fncCreateUserCustomToken({userId: userId});
    //         _log('_createUserCustomToken =>', result, result.data);    
    //         let data = (result.data) as any;
    //         token = data.token;
    //     } catch(e) {
    //         _log('_createUserCustomToken error =>',  e);
    //     }
    //     return token;       
    // }
}