// angular
import { environment } from 'src/environments/environment';
import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

// cf common
import { CFHelper, _flog, _log, _slog, _valid } from 'src/lib/cf-common/cf-common';

// lib
import { NPItemType, NPItem, NPNote, NPPageTemplate, NoteViewMode, NPNoteContent, NPPage, NPVisonImageAnnotationData, NPPageData } from 'src/lib/fb-noteapi/cf-noteapi';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';

// note-platfrom
import { CFEventsService } from './cf-event.service';
import { FBFileUploaderService } from './fb-file-upload.service';
import { CFTransactionService } from './cf-transaction.service';
import { AppSyncMngr } from './app-sync-mngr.service';

// etc
import { FBAuthService } from './fb-auth.service';
import { BLNotesService } from './bl-notes.service';
import { AppEventType, IAppWebBridgeEvent, Device, AppCommand, AppEvent, AppKeyCommandMap, AppDefaultState, AppDefaultConfig, AppMenuIdCommandMap, AppPalette, AppFonts, AppTemplateSizeList, AppSpecialUserAccount, AppCommandGuestAuth, AppMemberType, IAppWebBridgeEventParams, SidebarIds, AppIds } from 'src/_note-platform/note-platform.config';
import { AppSyncStore } from '../stores/app-sync.store'

import { NoteRendererLib } from 'src/lib/note-common/note-renderer.lib';
import { fabricObjectType } from 'src/lib/fabricjs/fabricjs-type';
import { EventNoticeIds, NoticeCategory, NoticeStore } from '../stores/notice.store';
import { AppBuildConfig } from 'src/_app-build-configs/app.build-config';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AppMember } from '../stores/member.store';
import { FBFunctionsRegion } from './fb-functions.service'; 
import { AppStore } from '../stores/app.store';
import { CalSkinFont } from '../modules/note-editor-container/views/note-editor/views/editor/note-month-canlendar-view/sn-note-pages-month-calendar/sn-note-calendar-skin-config';

const MIN_WIDTH_DESKTOP_VIEWMODE = 680;

declare const MD5: any;

// export enum SingleNoteAppId {
//     drawingdiary = "drawingdiary",
//     drawingcalendar = "drawingcalendar",
//     photocalendar = "photocalendar",
//     journal = "journal"
// }

export enum NoteEditorPresentationViewType {
    static = 'static',
    note = 'note',
    page = 'page'
}

const SAFE_AREA_INSETS = {
    top: -1,
    bottom: -1
}

export enum SidebarState {
    show = 'show',
//    hide = 'hide',
    close = 'close'
}

export enum LocalStateKeys {
    isShowNotePanelSidebar = 'isShowNotePanelSidebar'
}

@Injectable()
export class NotePlatformService {

    /* -------------------------------------------------------------------------- */
    /*                              private property                              */
    /* -------------------------------------------------------------------------- */

    //private _appInstanceKey:string = CFHelper.id.generateUUID(); // 현재 실행되는 앱의 인스턴스 아이디    
    private _config: any;   // user config : appConfig
    private _state: any;
    private _appBuildConfig = AppBuildConfig;

    /* -------------------------------------------------------------------------- */
    /*                               public property                              */
    /* -------------------------------------------------------------------------- */
    public appNoteCreateDate?: Date; // single-note-app에서 앱 시작일 무료사용기간체크에 사용.

    // main
    public currNote?: NPNote;   // #todo : state에 넣기
    public currTemplate?: NPPageTemplate;   // #todo : state에 넣기
    public currSelectedMenuItem?: any;
    public currSelectedMenuItemParams?: any;

    // editor
    public penPaletteList = AppPalette;
    public fonts = AppFonts;
    public openPresentation: boolean = false;

    public pageTemplateSizeList = AppTemplateSizeList;

    public mainContainerHeight: number = window.innerHeight;
    // public initialMainContainerHeight: number = window.innerHeight; // 초기에 모바일에서 메인 높이 고정값

    // pwa
    public pwaInstallPrompt: any;
 
    /* -------------------------------------------------------------------------- */
    /*                             show/hide sidebars                             */
    /* -------------------------------------------------------------------------- */
    public sidebarsState: any = {
        note: SidebarState.close,
    }

    resetSidebar() {
        this.sidebarsState = {
            note: SidebarState.close,        
        }
    }

    isShowSidebar(sidebar?: SidebarIds | string) {
        _valid(SidebarIds.note);
        let isShow = false;
        if (sidebar) {
            isShow = this.sidebarsState[sidebar] == SidebarState.show;
        } else {
            isShow = this.sidebarsState[SidebarIds.note] == SidebarState.show;
        }
        return isShow;
    }

    isCloseSidebar(sidebar: SidebarIds | string) {
        return this.sidebarsState[sidebar] == SidebarState.close;
    }

    // sidebarsState.primary 와 sidebarsState.note, sidebarsState.editor 는 배타적이라 sidebarsState.primary는 hide가 없다.
    activeSidebar(sidebar: SidebarIds | string, fromUserAction: boolean = false) {
        _valid(SidebarIds.note);
        _log('activeSidebar:active sidebar, sidebarsState =>', sidebar, this.sidebarsState);
        // 우선 1 : editor, primary, 
        // 우선 2 : note
        // 메인이 닫히면 note가 보임, 에디터가 보임
        if (sidebar == SidebarIds.note) {
            this.sidebarsState.note = SidebarState.show;
            // 패널이 열림 상태를 저장함
            if (fromUserAction && (this.isHoriViewMode() || this.isMobileViewMode())) {
                this.saveUserStateInDevice(LocalStateKeys.isShowNotePanelSidebar, true);
            }
        }
        this.events.fire(AppEvent.sidebar.opened, { key: sidebar });
        _log('activeSidebar:active2 sidebarsState =>', this.sidebarsState);
    }

    // hideSidebar(sidebar: SidebarIds | string) {
    //     this.sidebarsState[sidebar] = SidebarState.hide;
    // }

    closeSidebar(sidebar: SidebarIds | string, fromUserAction: boolean = false) {
        _valid(SidebarIds.note);
        _log('activeSidebar:close sidebar, sidebarsState =>', sidebar, this.sidebarsState);
        // if (sidebar == SidebarIds.primary) {
        //     //if (this.sidebarsState.primary !== SidebarState.close) {
        //         this.sidebarsState.primary = SidebarState.close;
        //         // if (this.sidebarsState.editor !== SidebarState.close) { this.sidebarsState.editor = SidebarState.show; }
        //         if (this.sidebarsState.note !== SidebarState.close) { 
        //             this.sidebarsState.note = SidebarState.show; 
        //         }
        //     //}
        // } 
        // else if (sidebar == SidebarIds.editor) {
        //     if (this.sidebarsState.editor !== SidebarState.close) {
        //         this.sidebarsState.editor = SidebarState.close;
        //         if (this.sidebarsState.note !== SidebarState.close) { 
        //             this.sidebarsState.note = SidebarState.show; 
        //             this.sidebarsState.primary = SidebarState.close; 
        //         }
        //     }
        // } 
        if (sidebar == SidebarIds.note) {
            this.sidebarsState.note = SidebarState.close;
            // 패널의 닫힘 상태를 저장함
            if (fromUserAction && (this.isHoriViewMode() || this.isMobileViewMode())) {
                this.saveUserStateInDevice(LocalStateKeys.isShowNotePanelSidebar, false);
            }
            // if (this.sidebarsState.primary !== SidebarState.close) { 
            //     this.sidebarsState.primary = SidebarState.show; 
            //     // this.sidebarsState.primary = SidebarState.close; 
            // }
        }
        this.events.fire(AppEvent.sidebar.closed, { key: sidebar });
        _log('activeSidebar:close2 sidebar, sidebarsState =>', sidebar, this.sidebarsState);
    }

    // 데스트탑 세로모드에서 모달
    isModalPopupMode() {
        return !this.isHoriViewMode() && !this.isMobileViewMode();
    }

    getSidebarWidth() {
        let width;
        if (this.isMobileViewMode()) {
            width = window.innerWidth;
        } else {
            width = window.innerWidth > 1024 ? 360 : 330; // 360px, 330px
        }
        return width;
    }

    getCurrentSidebarWidth(sidebarId?: SidebarIds | string) {
        let width = 0;
        if (this.isShowSidebar(sidebarId)) {
            width = this.getSidebarWidth();
        }
        return width;
    }

    //public isShowPrimarySidebar: boolean = false;

    /* -------------------------------------------------------------------------- */
    /*                               user state in device                         */
    /* -------------------------------------------------------------------------- */
    saveUserStateInDevice(dataFiledName: string, isShow: boolean) {
        const key = `${this.userId}-${dataFiledName}`;
        localStorage.setItem(key, JSON.stringify(isShow)); 
    }

    loadUserStateInDevice(dataFiledName: string): boolean {
        const key = `${this.userId}-${dataFiledName}`;
        let isShow: boolean = false;
        try {
            let data: string | null = localStorage.getItem(key);
            if (data) {
                isShow = JSON.parse(data);
            }
        } catch(e) {
            isShow = false;
        }
        return isShow;
    }

    // removeUserStateInDevice(dataFiledName: string) {
    //     const key = `${this.userId}-${dataFiledName}`;
    //     localStorage.removeItem(key);
    // }

    /* -------------------------------------------------------------------------- */
    /*                                    inset                                   */
    /* -------------------------------------------------------------------------- */

    setSafeAreaInsetsTop(top: number) {
        // if (!this.isSingleNoteApp() && !this.isJournalApp()) { top = 0; }
        //if (this.isDrawingCalendarApp()) { top = 0; } // 그림 달력은 가로/세로고정에 상단 여백이 없는게 기본

        // save
        localStorage.setItem('safeAreaInsetTop', top.toString());
        SAFE_AREA_INSETS.top = top;
        this.updateMainContainerHeight();
    }

    getInsetTop() {
        let top = 0;
        if (SAFE_AREA_INSETS.top == -1) {
            let topString = localStorage.getItem('safeAreaInsetTop');
            if (topString) {
                top = parseInt(topString);
            }
        } else {
            top = SAFE_AREA_INSETS.top;
        }

        // 값 보정 : isHoriViewMode 때문에 값이 수시로 바뀌어야 해서 여기서 보정해줘야 한다.
        // if (this.isIOSApp()) {
        //     // 타블릿 가로
        //     if (!this.isPhone() && this.isHoriViewMode() ) {
        //         top = 0;
        //     }
        // }
        return top;
    }

    updateMainContainerHeight() {
        // if (this._safeAreaInsets.top == -1) {
        //     let top = localStorage.getItem('safeAreaInsetTop');
        //     if (top !== null) {
        //         this._safeAreaInsets.top = parseInt(top);
        //         _log('safeAreaInsets:localStorage _safeAreaInsets.top =>', this._safeAreaInsets.top)
        //     } else {
        //         // if (this.isPhone() && this.isIOSApp()) {
        //         //     if (window.innerHeight > 780) {  // 아이폰인데 문제로 앱에서 크기 못받을 경우 임의로 넣어줘서 버그 방지
        //         //         this._safeAreaInsets.top = 55;
        //         //     } else {
        //         //         this._safeAreaInsets.top = 20;
        //         //     }
        //         // } else {
        //         //     this._safeAreaInsets.top = 0;
        //         // }
        //         _log('safeAreaInsets:localStorage:fail _safeAreaInsets.top =>', this._safeAreaInsets.top)
        //     } 
        // }

        // if (this.isDrawingCalendarApp()) { this._safeAreaInsets.top = 0; } // 그림 달력은 가로/세로고정에 상단 여백이 없는게 기본

        // 키보드가 나와서 resize 이벤트가 발생했다면 이 값은 update없이 무시함
        // if(this.isShowKeyboard) { 
        //     _log('keyboard:updateMainContainerHeight isShowKeyboard == true return');
        //     return; 
        // }
        this.mainContainerHeight = window.innerHeight - this.getInsetTop();
        _log('keyboard:updateMainContainerHeight window.innerHeight, mainContainerHeight =>', window.innerHeight, this.mainContainerHeight);
        //_log('safeAreaInsets:localStorage2 _safeAreaInsets.top =>', this._safeAreaInsets.top)
        //return this._safeAreaInsets;
    }

    /*
        이 함수는 journal에서는 사용안함
    */

    // 앱에서 safearea때문에 앱별로 다름 
    //getSingleNoteToolbarTopPadding() {
    // 예전에 INSETS를 패널에 개별로 넣어줬는데 Journal App 부터 main에 한번에 주는 것으로 바뀌었다.
    // 이 함수는 필요 없음 일단 그냥 0을 return 함
    // return 0;

    // if (this.isJournalApp()) { return 0; }
    // if (!this.isSingleNoteApp() || !this.isMobileViewMode()) { return 0; }
    // //_log('getSingleNoteToolbarTopPadding safeAreaInsets.top, safeAreaInsets.bottom =>', this.safeAreaInsets.top, this.safeAreaInsets.bottom);

    // // 리로드하게 되면 app.lauched를 받지 못해서 값이 0이다.
    // // bottom은 아직 사용 안함 / 주석 지우지 말기
    // // if (this.safeAreaInsets.bottom == -1) {
    // //     let bottom = localStorage.getItem('safeAreaInsetBottom');
    // //     if (bottom !== null) {
    // //         this.safeAreaInsets.bottom = parseInt(bottom);
    // //         _log('getSingleNoteToolbarTopPadding:localhost safeAreaInsets.bottom =>', this.safeAreaInsets.bottom)
    // //     }
    // // }
    // this.updateMainContainerHeight();
    // let top: number = 0;
    // if (this.isDrawingDiaryApp() || this.isJournalApp()) {
    //     if (this.isPhone()) {
    //         if(this._safeAreaInsets.top == 0) {
    //             top = 0;
    //         } else {
    //             top = this._safeAreaInsets.top > 50 ? this._safeAreaInsets.top - 20 : this._safeAreaInsets.top - 7;      // 상단에 꽤 많은 safearea?부분이 있어서 이정도 띄어야 함
    //         }
    //     } else {
    //         top = this._safeAreaInsets.top > 0 ? this._safeAreaInsets.top - 11 : 0;     // 아이패드 미니에서 5를 빼면 보기에 좋은데 문제는 하단 + 버튼과 달력이 겹침
    //     }
    // } else if (this.isDrawingCalendarApp()) {
    //     if (this.isPhone()) {
    //         top = 0;    // 특이한 사항, 가로고정모드에서 달력의 공간이 없어서
    //     } else {
    //         top = this._safeAreaInsets.top > 0 ? this._safeAreaInsets.top + 4 : 0;     // 타블릿에서 safe area감안해서 7px정도 띄어줌, 폰은 가로모드라서 띄면 안됨
    //     }
    // }
    // return top;
    //}

    /* -------------------------------------------------------------------------- */


    

    /* -------------------------------------------------------------------------- */
    /*                                프리미엄 / 구매                              */
    /* -------------------------------------------------------------------------- */

    public getRemainingDays() {
        if (!this.appBuildConfig.app.premium.availableDays) { return 0; }
        if (!this.appNoteCreateDate) {
            // 초기에는 이 값이 나옴 // appNoteCreateDate값을 얻기 전까지 
            //_log('getRemainingDays appNoteCreateDate null')
            return 0;
        }
        let differenceTime = new Date().getTime() - this.appNoteCreateDate.getTime();
        let differenceDays = Math.floor(differenceTime / (1000 * 3600 * 24));   // 0 1 2 3 4 5 6  /////   7
        let expireDay = this.appBuildConfig.app.premium.availableDays;
        let dday = expireDay - differenceDays;
        if (dday < 0) dday = 0;
        //_log('getRemainingDays dday =>', dday)
        return dday;
    }

    // 만료여부
    public isAppExpired() {
        if(this.hasExpireApp() == false) { return false; }
        //if (this.isJournalApp()) { return false; }
        //_log('isAppExpired appNoteCreateDate =>', this.appNoteCreateDate);
        if (!this.appNoteCreateDate) { return undefined; } // 아직 로그인 전이면 일단 만료 안된것으로 시작
        return this.getRemainingDays() <= 0;
    }

    // 프리미엄 여부 : 기본적으로 isPremiumMemberAsync를 사용하고 isPremiumMemberSnapshot이거는 템플릿에 async안되는데 사용한다.
    public isPremiumMemberSnapshot() {
        if (this.isDeveloper) { return true; }
        if (this.isGuest) { return true; } // 게스트는 항상 프리미엄이다.

        let appId: string = this.appBuildConfig.app.id;
        let member = this.getMemberSnapshot();
        //_log('isPremiumMember member =>', member);
        if (!member) { return false; }
        _valid(member);
        return member && member.isPremiumMember && member.isPremiumMember[appId];
    }

    // 기본적으로 이 함수를 사용, 비동기 안되는데만 isPremiumMemberSnapshot
    public async isPremiumMemberAsync() {
        let _isPremiumMember = this.isPremiumMemberSnapshot();
        if (_isPremiumMember) { return true; }

        // 프리미엄이 아닌경우 : 오류거나 실제 아니거나
        const member = await this.getSafeMember();
        _valid(member);
        return member && member.isPremiumMember && member.isPremiumMember[AppBuildConfig.app.id];
    }

    // log남기지 말기!! 계속 불림
    public hasAuthOfCommand(command: string) {
        let pass: boolean = true;
        //_log('hasAuthOfCommand isPremiumMemberSnapshot() && isAppExpired() =>', this.isPremiumMemberSnapshot(), this.isAppExpired());

        let memberType = this.isPremiumMemberSnapshot() ? AppMemberType.premiumMember : AppMemberType.member;
        if (memberType == AppMemberType.premiumMember) { return true; }

        // 일반적인 기능 제한일 경우 여기서 확인한다.
        let limitFeatures: string[] = this._appBuildConfig.app.premium.limitFeatures;
        for (let limitCommand of limitFeatures) {
            if (limitCommand == command) {
                pass = false;
                //_log('hasAuthOfCommand pass =>', pass);
            }
        }
        return pass;
    }

    /* -------------------------------------------------------------------------- */
    public checkItemLimit(itemType: NPItemType, currCount: number) {
        _flog(this.checkItemLimit, arguments);
        let pass: boolean = true;
        try {
            // admin은 제한없음
            if (this.isAdmin) { return true; }
    
            // 제한은 기본제한, 프리미엄 제한이 있는데 아직 기본제한을 사용안함
            const isPremiumMember = this.isPremiumMemberSnapshot();
            if (isPremiumMember) { return true; }
    
            // 프리미엄 제한이 있는지?
            const limit: any = this.appBuildConfig.app.premium.limitItem;
            const _limit: { name: string, per: string, count: number } = limit[itemType]; 
            if (!_limit) { return true; }
    
            // 제한
            if (currCount >= _limit.count) {
                pass = false;
                this.alertService.show(this.getLimitMessage(_limit));
            }
        } catch (e) {
            pass = false; // 체크하다가 에러나서 노트 생성이 안된 경우가 생김
        }
        return pass;
    }

    public getLimitMessage(limit: { name: string, per: string, count: number }) {       
        //if (this.isJournalApp()) {
            return `일반 회원은 최대  ${limit.count}개의 ${limit.name}을 만들 수 있습니다. 더 많은 ${limit.name}이 필요하시다면 프리미엄 회원으로 업그레이드해 보세요!`;
        //}
        //return `${appName}는 ${this.itemCountLimit[itemType].per}당 ${this.itemCountLimit[itemType].count}개의 ${this.itemCountLimit[itemType].name}만 생성할 수 있습니다.`
    }

    private _current: any = {};
    public isTextEditing: boolean = false;    // 텍스트 에디팅 중에는 keyword처리 안함

    // 뒤에 opacity로 '33'더해서 적용해야 함
    // FFFDF5
    public templateBgColorList = [
        "#FFF7F8", // Soft Pink
        "#F5F8FF", // Dusty Blue
        "#F5FAF3", // Sage Green
        "#FAF6FC", // Lavender Gray
        "#FFFDF5", // Warm Yellow       // 기본 색상
        "#FFF3ED", // Coral Peach
        "#F6FAFC", // Mist Blue
        "#FAF6F3",  // Light Mocha
         
        "#FEEBED", // Soft Pink (2단계)
        "#E4ECFF", // Dusty Blue
        "#E4F0E0", // Sage Green
        "#EEE4F5", // Lavender Gray
        "#FFF6DB", // Warm Yellow
        "#FFE0D1", // Coral Peach
        "#E3F0F5", // Mist Blue
        "#EEE4DD",  // Light Mocha

        // 너무 짙어서 선색과 안어울려서 뻄
        // "#FCD7DC", // Soft Pink (3단계)
        // "#CCDFFF", // Dusty Blue
        // "#D2E4CE", // Sage Green
        // "#DDCEE8", // Lavender Gray
        // "#FFEEBD", // Warm Yellow
        // "#FFC7AF", // Coral Peach
        // "#CDE3EB", // Mist Blue
        // "#DDCFC2"  // Light Mocha
    ]
        // 조금 짙은 버전
        //  "#FFF0F3", // Soft Pink
        // "#EAF0FF", // Dusty Blue
        // "#EDF5E8", // Sage Green
        // "#F2E9F7", // Lavender Gray
        // "#FFFCEB", // Warm Yellow
        // "#FFE8DC", // Coral Peach
        // "#F1F7FA", // Mist Blue
        // "#F4EDE8"  // Light Mocha

        // 글자색
        // "#95814F",   // Warm Yellow
        // "#8C5A5A",   // Soft Pink
        // "#4F5A95",   // Dusty Blue
        // "#5A7A4F",   // Sage Green
        // "#715C8C",   // Lavender Gray
        // "#A65C44",   // Coral Peach
        // "#4F6D7A",   // Mist Blue
        // "#7C5C4A"    // Light Mocha

    // [
    //     '', '#FFFFFF', '#FAE9E3', '#F7F3ED', '#EAE8EB', '#EDDFDF', '#FBEFE3',
    //     '#F8E6E5', '#EAEEE1', '#C0D3D8', '#DBDADD', '#FBF3EA', '#E6ECF3', '#E7E6DB',
    //     '#EFE8E8', '#F2DED3', '#C1B7B1', '#D4E2F0', '#F1EDE7', '#D7DBDE', '#E5E7FF',
    //     '#B6C9B9', '#C7D4CB', '#D1C1B9', '#CDB3BB', '#B88E85', '#FFCCA0', '#FEF9E4',
    //     '#FFF0E5', '#FEE5E4', '#E6D1EF', '#FFD2EA', '#FFC6C7'
    // ];

    public syncMngr: any;
    public transaction: CFTransactionService = new CFTransactionService();
    public isNoteLoadingFromUrl: boolean = false; // 노트를 주소로 로딩하고 있음, 이때는 singleNote생성을 하지 말아야

    // renderer
    public noteRenderer!: NoteRendererLib;

    public holidays: any;

    constructor(
        private router: Router,
        private activeRoute: ActivatedRoute,
        private notes: BLNotesService,
        public events: CFEventsService,

        //private responsiveService: BLResponsiveService, 
        private _fileUploader: FBFileUploaderService,
        private alertService: BLAlertService,
        private titleService: Title,
        public authService: FBAuthService,
        private appSyncStore: AppSyncStore,
        private noticeStore: NoticeStore,
        private appStore: AppStore
    ) {
        this._eventHandler();
        this.authService.isMobileDevice = this.isMobileDevice();
        this.loadAppData();
    }

    async loadAppData() {
        this.holidays = await this.appStore.getHolidays(); // holidays는 앱별로 다르기 때문에 여기서 가져옴
    }

    initNoteRenderer(canvas: any) {
        this.noteRenderer = new NoteRendererLib(canvas);
    }

    //public sidebarWidth: number;
    // public getSidebarWidth() {
    //     let width = 360;
    //     //return this.isMobileViewMode() ? window.innerWidth : Math.min(330, )
    //     if(this.isMobileViewMode()) {
    //         width = window.innerWidth;
    //     } else {
    //         width = window.innerWidth >= 1024? 360 : 330;
    //     }    
    //     return width;
    // }

    /* -------------------------------------------------------------------------- */
    /*                                  #renderer                                 */
    /* -------------------------------------------------------------------------- */
    async renderPreviewPages(noteContent: NPNoteContent, isReverse: boolean = false, isRemoveBg?: boolean, removeObjectType?: fabricObjectType | null | undefined) {
        _valid(this.noteRenderer);
        if (!this.noteRenderer) { return; }

        // 그림달력앱의 preview기본값
        if (this.appBuildConfig.noteTemplate.calendar.isRemoveBgAndDateObj) {
            // 배경제거
            if (isRemoveBg === undefined) {
                isRemoveBg = true;
            }
            // 날짜 제거
            if (removeObjectType === undefined) {
                removeObjectType = fabricObjectType.currDateTimeText;
            }
        }
        // page.previewCacheSvg 에 svg를 넣는다.
        return this.noteRenderer.renderPreviewPages(noteContent, isReverse, isRemoveBg, removeObjectType);
    }

    async renderPreviewPagesWithPages(noteContent: NPNoteContent, pages: NPPage[], isRemoveBg?: boolean, removeObjectType?: fabricObjectType | null | undefined) {
        return this.noteRenderer.renderPreviewPagesWithPages(noteContent, pages, isRemoveBg, removeObjectType);
    }

    public async renderPreviewPage(noteContent: NPNoteContent, page: NPPage, isRemoveBg?: boolean, 
        removeObjectType?: fabricObjectType | null | undefined, isChangeInnerPreviewCacheSvg: boolean = true) {
        _valid(this.noteRenderer);
        if (!this.noteRenderer) { return; }
        _flog(this.renderPreviewPage, arguments);

        // 그림달력일 경우 : 배경을 제외하고 날짜표시를 제외한다.
        if (this.appBuildConfig.noteTemplate.calendar.isRemoveBgAndDateObj) {
            if (isRemoveBg === undefined) {
                isRemoveBg = true;
            }
            if (removeObjectType === undefined) {
                removeObjectType = fabricObjectType.currDateTimeText;
            }
        }
        return this.noteRenderer.renderPreviewPage(noteContent, page, isRemoveBg, removeObjectType, isChangeInnerPreviewCacheSvg);
    }

    /* ---------------------------------browser--------------------------------- */
    // User-Agent에서 각 플랫폼을 판별하는 함수
    // function detectPlatform() {
    //     var userAgent = navigator.userAgent;

    //     if (userAgent.match(/Android/i) && userAgent.match(/wv/i)) {
    //         // 안드로이드 WebView
    //         return 'Android WebView';
    //     } else if (userAgent.match(/iPhone|iPad|iPod/i) && userAgent.match(/WebKit/i) && !userAgent.match(/CriOS/i)) {
    //         // iOS WebView
    //         return 'iOS WebView';
    //     } else if (userAgent.match(/iPhone|iPad|iPod/i) && userAgent.match(/WebKit/i) && userAgent.match(/CriOS/i)) {
    //         // Chrome Mobile (iOS)
    //         return 'Chrome Mobile (iOS)';
    //     } else if (userAgent.match(/iPhone|iPad|iPod/i) && userAgent.match(/WebKit/i)) {
    //         // Safari Mobile (iOS)
    //         return 'Safari Mobile (iOS)';
    //     } else if (userAgent.match(/Android/i) && userAgent.match(/Chrome/i)) {
    //         // Chrome Mobile (Android)
    //         return 'Chrome Mobile (Android)';
    //     } else {
    //         // 기타 브라우저
    //         return 'Unknown Browser';
    //     }
    // }

    // // 결과 출력
    // var platform = detectPlatform();
    // console.log('현재 플랫폼:', platform);

    /* -------------------------------------------------------------------------- */
    /*                               single note app                              */
    /* -------------------------------------------------------------------------- */
    isDarkMode(): boolean {
        return this._appBuildConfig && this._appBuildConfig.app && this._appBuildConfig.app && this._appBuildConfig.app.isDarkMode;
    }

    getTheme(): string {
        return this.isDarkMode() ? 'dark' : 'light';
    }

    // editorViewMode가 monthCalendar, '그림일기'이고
    public currEditViewMode?: NoteViewMode;
    getEditorTheme(): string {
        let theme = this.getTheme();
        if (this.currEditViewMode && this.currEditViewMode == NoteViewMode.monthCalendar) {
            theme = 'light'; // 여기는 나중에 노트설정에서 가져와야 함 
        }
        return theme;
    }

    public calednarBackgroundColor: string = '#fff';
    getInsetTopColor(): string {
        let color = this.getTheme() == 'dark'? '#000' : '#fff';
        // 달력일 경우 
        if (this.currEditViewMode && this.currEditViewMode == NoteViewMode.monthCalendar) {
            // 달력스킨의 배경색 
            color = this.calednarBackgroundColor;
        }
        return color;
    }

    // '일기'는 여러 노트를 가질 수 있음, 나머지가 single note app
    isSingleNoteApp(): boolean {
        return this._appBuildConfig && 
            this._appBuildConfig.app && 
            AppBuildConfig.app.id && 
            AppBuildConfig.app.id.length > 0 && 
            AppBuildConfig.app.id !== AppIds.journal? true : false;
    }

    isDrawingDiaryAppTemp() {
        return this._appBuildConfig.app.id == AppIds.drawingdiary;
    }

    // 노트 > 일기장
    // 노트보다 범위를 줄여서 일기장범위 앱 
    // 나중에 isSingleCalendarApp() 이거랑 정리가 필요함
    // 용어는 나중에 config에서 사전으로 정리
    // isDiaryApp(): boolean {
    //     return this.isDrawingCalendarApp() || this.isPhotoCalendarApp() || this.isJournalApp();
    // }

    // 페이지 날짜 순으로, 전체 보기 날짜순으로 소팅
    // isSingleCalendarApp(): boolean {
    //     return this.isDrawingDiaryApp() || this.isDrawingCalendarApp() || this.isPhotoCalendarApp();
    // }

    // isDrawingDiaryApp(): boolean {
    //     return AppBuildConfig.app.id == SingleNoteAppId.drawingdiary;
    // }

    // isDrawingCalendarApp2(): boolean {
    //     return AppBuildConfig.app.id == SingleNoteAppId.drawingcalendar;
    // }

    // isJournalApp(): boolean {
    //     return AppBuildConfig.app.id == SingleNoteAppId.journal;
    // }

    // isPhotoCalendarApp(): boolean {
    //     return AppBuildConfig.app.id == SingleNoteAppId.photocalendar;
    // }

    // 이용기간 제한이 있는 앱인가?
    hasExpireApp(): boolean {
        return this._appBuildConfig.app.premium.hasAppExpire;
    }

    getAppShortName(): string {
        return this._appBuildConfig.app.shortName;
    }

    setAppBuildConfig(config: any) {
        _flog(this.setAppBuildConfig, arguments);

        let _config = AppBuildConfig;
        Object.assign(_config, config);
        this._appBuildConfig = _config;

        if (_config.app.systemFont.size) {
            this.setAppFontConfig(config.app.systemFont.size);
        }

        this.authService.appId = config.app.id;
    }

    setAppFontConfig(sizes: any) {
        for (let size of sizes) {
            let key = Object.keys(size)[0];
            let value = size[key];
            document.documentElement.style.setProperty(`--font-size-${key}`, value);
        }
    }

    get appBuildConfig() {
        //_valid(this._appBuildConfig)
        return this._appBuildConfig;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 responsive                                 */
    /* -------------------------------------------------------------------------- */

    public get deviceName() {
        // let isMobile = this.responsiveService.isMobile();
        // let isDesktop = this.responsiveService.isDesktop();
        // let isTablet = this.responsiveService.isTablet();

        // let name: string = '';
        // if (isMobile) name = Device.mobile;
        // if (isDesktop) name = Device.desktop;
        // if (isTablet) name = Device.tablet;
        return this.isMobileViewMode() ? Device.mobile : Device.desktop;
    }



    // 1024보단 작다.
    public isMobileViewMode() {
        return !this.isDesktopViewMode();
        // let desktop = this.responsiveService.isDesktop();
        // let config = this.getConfigSnapshot();
        // return this.responsiveService.isMobile();
    }

    public isDesktopViewMode() {
        //let desktop = this.responsiveService.isDesktop();
        //let config = this.getConfigSnapshot();
        // 임시
        //let _isDesktop = desktop;
        // if(!config) {
        //     _isDesktop = desktop;
        //     // _log('appService !config isDesktop() =>', _isDesktop);
        // } else {
        //     _isDesktop = desktop || config.alwayDesktoViewpInDesktop;
        //     // _log('appService isDesktop() =>', _isDesktop);
        // }
        // if(config && config.alwayDesktoViewpInDesktop) {

        // } else {
        //     // 크기만 가지고 
        //     let width = window.innerWidth;
        //     _isDesktop = width > 1024;
        // }
        //_log('isDesktopViewMode isIOS =>', this.isIOS());
        // if (this.isIOS() && (this.isDrawingDiaryApp() || this.isDrawingCalendarApp())) {
        //     //_log('---------------> mobile, window.innerWidth', window.innerWidth)
        //     return false;
        // }

        //if (this.isJournalApp()) {
            return window.innerWidth >= MIN_WIDTH_DESKTOP_VIEWMODE;
        //}

        //return window.innerWidth >= 1024;
    }

    public isHoriViewMode() {
        // innerHeight였는데 ios keyboard 나오면 innerHeight가 줄어들어서 가로/세로 가 바뀌고 사이드바가 제대로 된 방향으로 안나옴
        // 그래서 this.mainContainerHeight로 변경
        return window.innerWidth > this.mainContainerHeight;
    }

    // 함수로 즉각적 판단이 아니라 상태를 저장하는 형태로 변경, 
    // 이유 : 키보드 나온 상태에서 로테이션 시 widndow.innerHeight가 줄어서 mainHeight가 줄어들어버림
    // 이로 인해 키보드 나오면 sidebar 위치가 변동 됨
    public isShowKeyboard: boolean = false;
    public updateIsShowKeyboard() {
        const viewport = window.visualViewport;
        if (!viewport) { _log('keyboard:isShowKeyboard viewport =>', viewport); return; }
        if (!this.isIOSApp()) { _log('keyboard:isShowKeyboard isIOSApp =>', false); return; }

        // _log('isShowKeyboard mainContainerHeight, visualViewport.height =>', 
        //     this.mainContainerHeight, (window as any).visualViewport.height)
        const viewportHeight = viewport.height;
        const windowHeight = this.mainContainerHeight; // window.innerWidth가 키보드 나오면 같아지지만 mainContainerHeight 이 값은 이전에 얻고 안변함

        //  키보드 높이는 360px, 차이는 360px
        this.isShowKeyboard = viewportHeight < windowHeight - 100;
        _log('keyboard:isShowKeyboard viewportHeight, mainContainerHeight, isShowKeyboard =>', viewportHeight, this.mainContainerHeight, this.isShowKeyboard);
    }

    // 모바일은 크기로 구분하는게 아니라 UA로 구분함
    // 우리의 경우 모바일 모드에서 데스크탑 구현과 같은 캐이스가 필요할 때
    public isMobileDevice() {
        const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        var isIPadPro = /Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;  // ipad pro는 이렇게 따로 체크해줘야 함
        return regex.test(navigator.userAgent) || isIPadPro;
    }

    public getPanleContainerWidth(padding: number = 0) {
        return this.isMobileViewMode() ? window.innerWidth - 20 - padding : (window.innerWidth <= 1024 ? 330 - 20 - padding : 360 - 20 - padding)
    }

    // public isDesktopWithUA() {
    //     return !this.isMobileDevice();
    // }

    // public isTablet() {
    //     let tablet = this.responsiveService.isTablet();
    //     let config = this.getConfigSnapshot();

    //     // 임시
    //     let _isTablet;
    //     if(!config) {
    //         _isTablet = tablet;
    //         // _log('appService !config isTablet() =>', _isTablet);
    //     } else {
    //         _isTablet = tablet || config.alwayDesktopViewInInTablet;
    //         // _log('appService isTablet() =>', _isTablet);
    //     }

    //     return _isTablet;
    // }

    /* -------------------------------------------------------------------------- */
    public isPhone(): boolean {
        let long;
        let short;
        if (window.innerWidth > window.innerHeight) {
            long = window.innerWidth;
            short = window.innerHeight;
        } else {
            long = window.innerHeight;
            short = window.innerWidth;
        }
        let _isPhone = long / short > 1.6 && this.isMobileDevice();
        return _isPhone;
    }

    // public isLandscapeInPhone() : boolean {

    // }

    public isIOS(): boolean {
        // const userAgent = navigator.userAgent;
        // return /iPhone|iPad|iPod/i.test(userAgent);
        return [
            'iPad Simulator',
            'iPhone Simulator',
            'iPod Simulator',
            'iPad',
            'iPhone',
            'iPod',
            // 'MaxIntel'
        ].includes(navigator.platform)
            // iPad on iOS 13 detection
            || (navigator.userAgent.includes("iPhone") || (navigator.userAgent.includes("Mac") && "ontouchend" in document))
    }

    public isIOSApp(): boolean {
        return this.isIOS() && !!(window as any).webkit && !!(window as any).webkit.messageHandlers;
    }

    // ios, not App(webview)
    public isIOSWeb(): boolean {
        return this.isIOS() && !this.isIOSApp();
        // const userAgent = navigator.userAgent;
        // return /^((?!chrome|android).)*safari/i.test(userAgent) && !this.isIOSApp();
    }

    // public isIPhone(): boolean {
    //     return /iPhone/i.test(navigator.userAgent);
    // }
    //
    public isAndriod(): boolean {
        return this.isMobileDevice() && !this.isIOS();
    }

    public isAndroidWeb(): boolean {
        return this.isMobileDevice() && !this.isIOS() && !this.isAndroidApp();
    }

    // 주의 : 이건 우리 앱에서 만 가능함, andriod app에서 blankAndroidApp를 미리 넣어줬음
    public isAndroidApp(): boolean {
        return this.isMobileDevice() && (window as any).blankAndroidApp !== undefined;
    }

    //window.webkit && window.webkit.messageHandlers

    // public isOnlySafariMobile() {
    //     return !this.isIOSApp() || (this.isIOSApp() && isSafariMobile())
    // }

    // public isSafariMobile() {
    //     const userAgent = navigator.userAgent;
    //     return /^((?!chrome|android).)*safari/i.test(userAgent);;
    // }

    // 미사용
    // public isAndriod() {
    //     return /Android/i.test(navigator.userAgent);
    // }

    /* -------------------------------------------------------------------------- */

    // 스테이지인지
    public isStage() {
        return window.location.href.includes('stage');
    }

    public isProd() {
        return environment.production;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #user                                    */
    /* -------------------------------------------------------------------------- */

    public isTest() {
        return environment.test;
    }

    // 로그인이 되후 호출해야 함 : 아니면 오류가 발생함 
    // 그럼 왜 쓰나? async함수로 만들어야 하는데 그럼 너무 이걸 사용하는 함수도 비동기가 되니까 그냥 실험적으로 체크해서 값없음면 다시 가져옴
    public get userId() {
        return this.authService.getUserIdSnapshot();
    }

    // onLoading 이벤트에서 넣어준다. 이렇게 하면 실제 localhost cache값이 적용이 안됨, 그래서 실제 로그인 안되면 null
    // 실제 값을 외부에서 넣어주려고 이렇게 바꿈  why? 노트 주소해석에서 userId없어서 getSafeUser()했는데 이때 성공하면 바로 this._uid값을 갱신을 안함 
    //public userId: string = ''; 

    public get userName() {
        return this.authService.getMemberNameSnapshot();
    }

    public async getSafeUser() {
        return this.authService.getSafeUser();
    }

    public async getSafeUserId() {
        return this.authService.getSafeUserId();
    }

    // public awaitCheckLogined() {
    //     return this.authService.awaitCheckLogined();
    // }

    public async getSafeMember(): Promise<AppMember> {
        return this.authService.getSafeMember();
    }

    public getMemberSnapshot() {
        return this.authService.getMemberSnapshot();
    }

    public get isAdmin() {
        return this.authService.isAdmin();
    }

    public get isDeveloper() {
        return this.authService.isDeveloper();
    }

    public isForceNormalUser: boolean = false;  // 게스트 모드 강제 해지
    public get isGuest(): boolean {
        if (this.isDeveloper) { return false; }
        let email = this.authService.getUserEmail();
        let index = AppSpecialUserAccount.guest.findIndex(item => item.email == email);
        return index > -1 && !this.isForceNormalUser;
    }

    // 게스트는 이용 못하는 곳에 
    // guardGuest(): boolean /* isPass */ {
    //     if (this.isGuest) {
    //         this.alertService.confirm('해당 기능은 둘러보기 모드에서 실행할 수 없습니다. 지금 무료로 가입하고 라이프로그랩를 시작하시겠습니까?').then(() => {
    //             this.authService.logout();
    //         });
    //         return false;
    //     }
    //     return true;
    // }


    /* -------------------------------------------------------------------------- */
    /*                               #event handler                               */
    /* -------------------------------------------------------------------------- */
    _eventHandler() {
        _log('_eventHandler')
        this.events.on(AppEvent.item.updated.name, (item: NPItem) => {
            _valid(item);
            if (this.currNote?._key == item._key || this.currTemplate?._key == item._key) {
                this.titleService.setTitle(item.name);
            }
        }, 'NotePlatformService');
        this.events.on(AppEvent.note.opened, (note: NPNote) => {
            _valid(note);
            _valid(note.name);
            this.currNote = note;
            _log('AppService::AppEvent.note.opened currNote =>', this.currNote);
            this.titleService.setTitle(note.name);
        }, 'NotePlatformService');
        // this.events.on(AppEvent.template.opened, (template: NPPageTemplate) => {
        //     _valid(template);
        //     _valid(template.name);
        //     this.currTemplate = template;
        //     if (!this.isSingleNoteApp()) {
        //         this.titleService.setTitle(template.name);
        //     }
        //     _log('AppService::AppEvent.template.opened currTemplate =>', this.currTemplate, template.name);
        // }, 'NotePlatformService');
        this.events.on(AppEvent.note.closed, (param: any) => {
            _log('AppService::AppEvent.template.closed param =>', param);
            this.currNote = undefined;
            if (this.currTemplate == undefined && this.currNote == undefined) {
                this.titleService.setTitle(this._appBuildConfig.app.shortName);
            }
        }, 'NotePlatformService');
        this.events.on(AppEvent.template.closed, (template: NPPageTemplate) => {
            this.currTemplate = undefined;
            if (this.currTemplate == undefined && this.currNote == undefined) {
                this.titleService.setTitle(this._appBuildConfig.app.shortName);
            }
            _log('AppService::AppEvent.template.closed currTemplate =>', this.currTemplate);
        }, 'NotePlatformService');
        this.events.on(AppEvent.note.presentation.opened, () => {
            this.openPresentation = true;
        }, 'NotePlatformService');
        this.events.on(AppEvent.note.presentation.closed, () => {
            this.openPresentation = false;
        }, 'NotePlatformService');

        this.authService.on((isLogin: boolean, userId: string, isJoin: boolean, token: string = "") => {
            _log('_eventHandler::auth isLogin, userId, isJoin =>', isLogin, userId, isJoin);
            //this.userId = userId;
            
            // 만약 회원 가입 이면
            if (isJoin) {
                this._afterJoinMemberProcess(userId);
            }

            if (isLogin) {
                this.onLogin(userId);

                this.sendCommandToApp(AppCommand.app.syncLogin, {
                    userId: userId,
                    key: token,
                    data: ''
                })
            } else {
                this.onLogout(userId);
                this.sendCommandToApp(AppCommand.app.syncLogout, {
                    userId: userId,
                    key: '',
                    data: ''
                })
            }

        });

    }


    /* -------------------------------------------------------------------------- */
    /*                                configration                                */
    /* -------------------------------------------------------------------------- */

    // loadConfig, SaveConfig 는 설정값을 db에서 가져올때 / 저장할때만 사용하고 
    // 내부에서 설정값 참조는 getConfig를 상용함  

    private _isCreatingConfig: boolean = false;
    // async loadConfig() {
    //     let userId = this.userId;
    //     _log('loadConfig userId =>', userId);
    //     if (!userId || userId.length == 0) {
    //         return new Promise((resolve: any, reject: any) => {
    //             this.events.on(AppEvent.auth.logined, (userId: string) => {
    //                 _valid(userId);
    //                 this._loadConfigAfterLogin(userId).then((resp: any) => {
    //                     resolve(resp);
    //                 })
    //             }, 'NotePlatformService');
    //         });
    //     }
    //     return this._loadConfigAfterLogin(userId);
    // }

    async loadConfig() {
        _flog(this.loadConfig, arguments);

        let userId = this.userId;
        if (!userId) {
            userId = await this.authService.getSafeUserId();
            _log('loadConfig userId =>', userId);
        }

        let config = await this.notes.fbStoreApi.get('AppConfig', userId, true);
        _log('AppService::loadConfig config =>', config);
        if (!config) {
            let _config: any = AppDefaultConfig;
            _config.userId = userId;
            if (!this._isCreatingConfig) {
                this._isCreatingConfig = true;
                _log('_loadConfigAfterLogin _config, userId =>', _config, userId);
                await this.notes.fbStoreApi.create('AppConfig', _config, userId); // userId를 키로 사용함
                this._isCreatingConfig = false;
            }
            _log('AppService::loadConfig::create config =>', config);
            config = _config;
        }
        _log('AppService::loadConfig config =>', config);
        this._config = config;
        return config;
    }

    async saveConfig(data: any, configKey?: string) {
        _flog(this.saveConfig, arguments);
        let userId = this.userId;
        if (!_valid(this._config)) { return; }
        if (!_valid(data)) { return; }
        _valid(userId);
        if (!userId || userId.length == 0) { return; }
        _valid(userId == data.userId);

        let config: any;
        if (configKey) {
            this._config[configKey] = data;
            config = this._config;
        } else {
            if (!data._key) {
                data._key = this._config._key;
            }
            config = data;
        }
        let respConfig = await this.notes.fbStoreApi.set('AppConfig', userId, config);
        if (!respConfig) {
            return;
        }
        _log('AppService::saveConfig respConfig =>', respConfig);
        this._config = respConfig;
        this.events.fire(AppEvent.config.updated, respConfig);
        return respConfig;
    }

    // 로그인이 안되면 undefined를  return한다.
    async loadConfigByKey(configKey?: string) {
        if (!this._config) {
            this._config = await this.loadConfig();
        }
        _valid(this._config);
        _log('loadConfigByKey configKey, _config =>', configKey, this._config);

        // config data repair
        if (configKey && configKey.length > 0) {
            if (!this._config[configKey]) {
                let config: any = AppDefaultConfig;
                this._config[configKey] = config[configKey];
            }
        }
        return configKey ? _valid(this._config[configKey]) : this._config;
    }

    getConfigSnapshot(configKey?: string) {
        let userId = this.userId;
        if (!this._config) {
            return null;
        }
        _valid(this._config);
        // _log('getConfig configKey =>', configKey);

        // config data repair
        if (configKey && configKey.length > 0) {
            if (!this._config[configKey]) {
                let config: any = AppDefaultConfig;
                this._config[configKey] = config[configKey];
            }
        }
        return configKey ? _valid(this._config[configKey]) : this._config;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #store                                   */
    /* -------------------------------------------------------------------------- */
    // async loadMyStore() {
    //     let userId = this.userId;
    //     _valid(userId);
    //     if (!userId || userId.length == 0) { return {} }
    //     let myStore = await this.notes.fbStoreApi.get('AppMyStore', userId, true);
    //     _log('AppService::loadMyStore myStore =>', myStore);
    //     if(!myStore) {
    //         let _myStore: any = AppDefulatMyStore;
    //         _myStore.userId = userId;
    //         await this.notes.fbStoreApi.create('AppMyStore', _myStore); // userId를 키로 사용함
    //         myStore = _myStore;
    //     } 
    //     return myStore;
    // }


    public isShowNotePanelSidebarAtInit: boolean = false;
    initNoteSidebar() {
        // lacal에 저장한 데이타
        try {
            let isShowNotePanel = this.loadUserStateInDevice(LocalStateKeys.isShowNotePanelSidebar);
            this.isShowNotePanelSidebarAtInit = isShowNotePanel? isShowNotePanel : false;
        } catch(e) {
            this.isShowNotePanelSidebarAtInit = false;
        }

        _log('initNoteSidebar notePnael =>', this.isMobileViewMode(), this.isHoriViewMode(), this.isShowNotePanelSidebarAtInit);
        // 모바일이거나 가로뷰일 때만 패널 열림 여부가 저장된다.
        if (this.isShowNotePanelSidebarAtInit && (this.isMobileViewMode() || this.isHoriViewMode())) {
            //setTimeout(() => {
                this.sendCommand(AppCommand.sidebar.open, SidebarIds.note)            
            //}, 500);

            // 타이머를 주면 먼저 열리고 안주면 달력이 전체로 그려지고 줄어드는게 보임
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                    #auth                                   */
    /* -------------------------------------------------------------------------- */
    async onLogin(userId: string) {
        _flog(this.onLogin, arguments);

        // 사이드바 열림 닫힘 상태 로컬스토리지에서 가져오기
        this.initNoteSidebar();        

        await this.loadConfig();
        await this.loadState();
        // 이상하게 AppEvent.auth.logined 이벤트를 보내는데 못받을 때가 있어서 지연해줌, 1초주면 실험적으로 항상 받음
        // 윗 값들이 필요한 경우 떄문에 윗값을 모두 로딩하고 진행
        setTimeout(() => {
            this.events.fire(AppEvent.auth.logined, userId);
        }, 1);

        await this.updateNewNotice();
        this.syncMngr = new AppSyncMngr(userId, this.events, this.notes, this.appSyncStore);


        if (this.isGuest) {
            this.alertService.toast("둘러보기 모드입니다. 미리 써보기 위한 공간으로 글이 자동으로 삭제 될 수 있습니다.");
            setTimeout(() => {
                this.alertService.toast("실제 사용은 개인 계정으로 이용바랍니다.");
            }, 4000)
        }
    }

    onLogout(userId: string) {
        this.events.fire(AppEvent.auth.logouted);
        this.resetSidebar();
    }



    /* -------------------------------------------------------------------------- */
    /*                                    #sync                                   */
    /* -------------------------------------------------------------------------- */

    // // 노트리스트 싱크
    // private _latestNoteListUpdateDate;
    // syncMngr

    // 1. AppSync/{userId}/noteListUpdateDate   값을 가져온다.


    /* -------------------------------------------------------------------------- */
    /*                                app #state                                  */
    /* -------------------------------------------------------------------------- */
    async loadState() {
        let _userId = await this.authService.getSafeUserId();
        let state = await this.notes.fbStoreApi.get('AppState', _userId);
        _log('AppService::loadState state =>', state);
        state = await this.repairState(state, _userId);
        _log('AppService::loadState2 state =>', state);
        this._state = state;
        return state;
    }

    private _isCreatingState: boolean = false;
    async repairState(state: any, userId: string) {
        if (!state) {
            // 없으면 새로 만듦
            state = AppDefaultState;
            state.userId = userId;
            if (!this._isCreatingState) {
                this._isCreatingState = true;
                await this.notes.fbStoreApi.create('AppState', state, userId); // 비동기 함수지만 그냥 호출함 
                this._isCreatingState = false;
            }
        } else {
            let isChanged: boolean = false;
            // 개별 보완 : 데이타 업데이트 관련
            if (!state.customPalette) {
                state.customPalette = AppDefaultState.customPalette;
                isChanged = true;
            }
            if (!state.customPalette.pen) {
                state.customPalette.pen = AppDefaultState.customPalette.pen;
                isChanged = true;
            }
            if (!state.customPalette.marker) {
                state.customPalette.marker = AppDefaultState.customPalette.marker;
                isChanged = true;
            }
            if (state.isShowPageGridSidebar === undefined) {
                state.isShowPageGridSidebar = true;
                isChanged = true;
            }

            if (state.penPalette.pen.depth && !state.penPalette.pen.depth[0]) {
                state.penPalette.pen.depth[0] = 1;
                isChanged = true;
            }
            if (state.penPalette.pen.depth && !state.penPalette.pen.depth[1]) {
                state.penPalette.pen.depth[1] = 1;
                isChanged = true;
            }
            if (state.penPalette.pen.depth && !state.penPalette.pen.depth[2]) {
                state.penPalette.pen.depth[2] = 1;
                isChanged = true;
            }

            if (state.penPalette.marker.depth && !state.penPalette.marker.depth[0]) {
                state.penPalette.marker.depth[0] = 1;
                isChanged = true;
            }
            if (state.penPalette.marker.depth && !state.penPalette.marker.depth[1]) {
                state.penPalette.marker.depth[1] = 1;
                isChanged = true;
            }
            if (state.penPalette.marker.depth && !state.penPalette.marker.depth[2]) {
                state.penPalette.marker.depth[2] = 1;
                isChanged = true;
            }
            if (isChanged) {
                this.notes.fbStoreApi.set('AppState', userId, state);
            }
        }
        _log('repairState state =>', state);
        return state;
    }

    async saveState(stateKey: string, data: any) {
        _flog(this.saveState, arguments);
        let userId = await this.authService.getSafeUserId();
        if (!_valid(this._state)) { return; }
        if (!_valid(data !== undefined)) { return; }

        let state: any;
        if (stateKey) {
            this._state[stateKey] = data;
            state = this._state;
        } else {
            if (!data._key) {
                data._key = this._state._key;
            }
            state = data;
        }
        let respState: any = await this.notes.fbStoreApi.set('AppState', userId, state);
        if (!respState) {
            return;
        }
        _log('AppService::saveState respConfig =>', respState);
        this._state = respState;

        // fire event
        let _event: any = AppEvent.state.updated; // any type으로 변환 (오류나니까)
        _valid(_event[stateKey]);
        this.events.fire(_event[stateKey], respState[stateKey]);
        return respState;
    }

    async getState(stateKey: string) {
        if (!_valid(stateKey && stateKey.length > 0)) { return; }
        //let userId = this.userId;
        if (!this._state) {
            this._state = await this.loadState();
        }
        //_log('getState stateKey =>', stateKey, this._state[stateKey]);

        // state data repair
        if (this._state[stateKey] === undefined) {
            let state: any = AppDefaultState;
            this._state[stateKey] = state[stateKey];
        }
        return this._state[stateKey];
    }

    /* -------------------------------------------------------------------------- */
    /*                              lastOpenedNoteKey                             */
    /* -------------------------------------------------------------------------- */
    async setLastOpenedNoteKey(noteKey: string) {
        if (!this._state) {
            this._state = await this.loadState();
        }
        this.saveState('lastOpenedNoteKey', noteKey);
    }

    async getLastOpenedNoteKey(): Promise<string | null> {
        return await this.getState('lastOpenedNoteKey');
    }

    async resetLastOpenedNoteKey() {
        if (!this._state) {
            this._state = await this.loadState();
        }
        this.saveState('lastOpenedNoteKey', '');
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #password                                 */
    /* -------------------------------------------------------------------------- */
    encryptionPassword(password: string) {
        return MD5(password);
    }

    async checkPassword(note: NPNote, passwordKey: string) {
        let isPass: boolean = false;
        // 노트에 패스워드가 우선임
        if (note && note.password) {
            isPass = note.password == passwordKey;
        } else {
            let config = await this.loadConfigByKey();
            _log('checkPassword passwordKey, _passwordKey =>', passwordKey, config.password);
            isPass = config.password == passwordKey;
        }
        return isPass;
    }

    async getPassword(note?: NPNote) {
        let password: string;
        if (note && note.password) {
            password = note.password;
        } else {
            let config = await this.loadConfigByKey();
            password = config.password;
        }
        return password;
    }

    async savePassword(passworMD5: string) {
        let _config = await this.loadConfigByKey();
        _config.password = passworMD5;
        this.saveConfig(_config);
    }

    /* -------------------------------------------------------------------------- */
    /*                                 #command                                   */
    /* -------------------------------------------------------------------------- */

    private _getCommandFromMenuId(menuId: string) {
        let appCommand: any = AppCommand;
        _valid(menuId);
        let ids = menuId.split('.');
        let command;
        if (ids.length == 1) {
            command = appCommand[ids[0]];
        } else if (ids.length == 2) {
            command = appCommand[ids[0]][ids[1]];   // menuId과 command가 같다면 우선 직접 얻는다.
        } else if (ids.length == 3) {
            command = appCommand[ids[0]][ids[1]][ids[2]];   // menuId과 command가 같다면 우선 직접 얻는다.
        }

        if (!command) {
            command = AppMenuIdCommandMap[menuId];  // 다르다면 map에서 얻는다.
        }
        return command;
    }

    // menu -> command
    sendCommandFromMenuId(menuId: string, params: any, extParams: any) {
        _valid(menuId);
        let command = this._getCommandFromMenuId(menuId);
        _valid(command);
        this.sendCommand(command, params, extParams);
    }

    // key -> command
    sendCommandFromKeyId(keyId: string, params: any) {
        _valid(keyId);
        let appCommand: any = AppCommand;
        let command = appCommand[keyId];
        _valid(command);
        this.sendCommand(command, params);
    }

    sendCommand(_command: string, params?: any, extParams?: any) {
        _log('coommand' + ' : ' + _command + ' /// ' + this.authService.getUserEmail() + ' ' + this.isGuest);
        _log('sendCommand _command =>', _command);
        if (this.isGuest) {
            // 명시적으로 false한 경우, 나머지는 pass
            if (AppCommandGuestAuth[_command] && AppCommandGuestAuth[_command].guest === false) {
                let message = '이 기능은 둘러보기 모드에서 실행할 수 없습니다. 지금 무료로 가입하고 라이프로그랩를 시작하시겠습니까?';
                if (this.isSingleNoteApp()) {
                    message = `이 기능은 둘러보기 모드에서 실행할 수 없습니다. 지금 ${this._appBuildConfig.app.shortName}를 시작하시겠습니까?`;
                }
                this.alertService.confirm(message).then(() => {
                    this.authService.logout();
                });
                return;
            }
        } else {
            if (this.hasAuthOfCommand(_command) === false) {
                this.alertService.show('이 기능은 👑프리미엄 전용 기능입니다. 지금 할인된 가격으로 프리미엄을 이용해보세요.😊').then(() => {
                    this.sendCommand(AppCommand.popup.purchase);
                });
                return;
            }
        }
        this.events.fire(_command, params, extParams);
    }

    commandHandler(command: string, listener: any, scope?: string) {
        this.events.on(command, listener, scope);
    }

    // keyName이 여러개이면 처음것만 나옴 / 대표 hot key
    getKeyNameFromCommand(command: string): string | undefined {
        let keyMap: Array<any> = AppKeyCommandMap;
        let item = keyMap.find(item => item.command == command);
        return item ? item.keyName : undefined;
    }

    commandFromKeyName(keyName: string): string {
        let keyMap: Array<any> = AppKeyCommandMap;
        let command: string = '';
        if (this.isTextEditing) {
            return '';
        }
        for (let item of keyMap) {
            if (item.keyName == keyName) {
                if (item.when && item.when.length > 0) {
                    if (this.getCurrent(item.when)) {
                        command = item.command;
                        break;
                    }
                } else {
                    command = item.command;
                    break;
                }
            }
        }
        _log('commandFromKeyName keyName, command =>', keyName, command);
        return command;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #image                                   */
    /* -------------------------------------------------------------------------- */
    async fileToImageURI(file: any, userId?: string): Promise<any> {
        _log('fileToImageURI file =>', file);
        let _userId = userId ? userId : this.userId;
        let uri: string = '';
        let _file: any = {};
        // if (file.type == 'image/svg+xml') {
        //     // svg
        //     let svgData: string | ArrayBuffer = await readFile(file, readFileType.text, ['svg']);
        //     if (!svgData) { throw new Error(NPError.stickerFileReadFail); }
        //     uri = await this.notes.api.createSvgResource(NPResourceType.svg, svgData, _userId);
        //     _log('fileToURI uri, svgData =>', uri, svgData);

        // } else if(file.type == 'image/png' || file.type == 'image/jpeg') {
        // if(file.type.split('/')[0] !== 'video') {
        return new Promise((resolve, reject) => {
            try {
                this._fileUploader.imageUploadByFb(file, 'userContent', _userId).then((_uri) => {
                    uri = _uri;
                    console.log("_fileUploader imageUploadByFb file =>", uri);
                    resolve(uri);
                }).catch(() => { reject(); });
            } catch (e: any) {
            }
        });
        // } else {
        // // } else if(file.type.split('/')[0] == 'video') {
        //     throw new Error(NPError.notSupportVideoType);
        // }
        //  else {
        //     throw new Error(NPError.notAllowFileType);
        // }
        return uri;
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #current #keyboar                         */
    /* -------------------------------------------------------------------------- */

    // keyboard 처리의 범위를 정하기 위해 만듦
    // AppCurrent type
    setCurrent(currunt: any, onOff: boolean = true) {
        //_log('setCurrent currunt, this._current[currunt] =>', currunt, this._current[currunt]);
        if (this._current[currunt] == undefined) {
            this._current[currunt] = false;
        }
        this._current[currunt] = onOff;
        _log('setCurrent _current =>', this._current);
    }

    getCurrent(currunt: any) {
        _log('getCurrent currunt =>', currunt);
        return this._current[currunt] == undefined ? false : this._current[currunt];
    }

    /* -------------------------------------------------------------------------- */
    // async makePreviewSvgFromPage(page: NPPage) : Promise<string> {
    //     //
    // }

    /* -------------------------------------------------------------------------- */
    /*                            app-webview event bridge                            */
    /* -------------------------------------------------------------------------- */

    fireEventFromApp(event: CustomEvent) {
        _log('app::onEventFromApp =>', event, event.detail);
        let data: IAppWebBridgeEvent = JSON.parse(event.detail);
        _log('app::onEventFromApp type, name, params =>', data.eventType, data.eventName, data.params);
        _valid(data.eventType);

        if (data.eventType == AppEventType.command) {
            this.sendCommand(data.eventName, data.params);
        } else if (data.eventType == AppEventType.event) {
            this.events.fire(data.eventName, data.params);
        }
    }

    public sendCommandToApp(commandName: string, params?: IAppWebBridgeEventParams) {
        let event: IAppWebBridgeEvent = {
            eventType: 'command',
            eventName: commandName,
            params: params
        }

        this._fireEventToApp(event);
    }

    public fireEventToApp(eventName: string, params?: any) {
        let event: IAppWebBridgeEvent = {
            eventType: 'event',
            eventName: eventName,
            params: params
        }
        this._fireEventToApp(event);
    }

    private _fireEventToApp(appWebEvent: IAppWebBridgeEvent) {
        if ((window as any).webToApp) {
            (window as any).webToApp(appWebEvent.eventType, appWebEvent.eventName, appWebEvent.params);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #navigate                                 */
    /* -------------------------------------------------------------------------- */
    //public isShowPopupPanelOverEditor: boolean = false; // 사이드바 메인 컨테이너를 우선한다.

    // 에디터 컨포너트가 보이는 조건 : 모바일에서만 의미가 있음
    isShowEditorContainerInMobile() {
        return this.isMobileViewMode() && (this.currNote || this.currTemplate || this.openPresentation);
            //&& !this.isShowPopupPanelOverEditor;
    }
    
    popupPanel(activityBarId: string, panelId?: string, segmentId?: string, locationParams?: any) {
        _flog(this.popupPanel, arguments);
        // this.isShowPopupPanelOverEditor = false; // 화면이 깜박여서 주석 처리 함
        //this.sendCommand(AppCommand.sidebar.open, activityBarId); // 패널이 한번 뜨고 x를 누르면 sidebar가 닫혀서 다시 사이드바를 열어줘야 함
        this.navigatePanel(activityBarId, panelId, segmentId, locationParams);
        // setTimeout(() => {
        //     this.isShowPopupPanelOverEditor = true;
        // }, 20);
        //_log('popupPanel isShowPopupPanelOverEditor =>', this.isShowPopupPanelOverEditor);
    }

    navigatePanel(activityBarId: string, panelId?: string, segmentId?: string, locationParams?: any) {
        let url = `/main/${activityBarId}`;
        if (panelId) {
            url += `/${panelId}`;
        }
        if (segmentId) {
            url += `/${segmentId}`;
        }
        _log('navigatePanel url =>', url);

        const _queryParams = this.activeRoute.snapshot.queryParams;
        _log('navigatePanel queryParams =>', _queryParams);
        let queryParams = Object.assign({}, _queryParams);
        if (locationParams) {
            Object.assign(queryParams, { locationParams: locationParams });
        }

        // 현재 노트가 열린 상태를 유지하기 위해서 queryParams은 그대로 둔다.
        this.router.navigate([url], { queryParams: queryParams });
    }   

    // activeViewInMobile : editor or notePanel
    navigateUrlToNote(note: NPNote, pageKey?: string, viewMode?: NoteViewMode, activeViewInMobile: string = 'sidebar', isRefresh: boolean = false) {
        _flog(this.navigateUrlToNote, arguments);
        let url: string = this.router.url;
        url = url.split('?')[0];

        // set noteKey
        const _queryParams = this.activeRoute.snapshot.queryParams;
        _log('navigateUrlToNote1 queryParams =>', _queryParams);
        let queryParams = Object.assign({}, _queryParams);
        Object.assign(queryParams, { editType: 'note', editItemKey: note._key });

        // update pageKey
        if (pageKey && pageKey.length > 0) {
            queryParams['pageKey'] = pageKey;
        } else {
            delete queryParams['pageKey'];
        }

        if (viewMode) {
            queryParams['editViewMode'] = viewMode;
        }

        if (isRefresh) {
            queryParams['refresh'] = 'true';
        }

        // 노트를 새로 열면 기존에 view창은 닫아준다.
        delete queryParams['viewType'];
        delete queryParams['viewItemKey'];
        delete queryParams['viewPageKey'];

        // 모바일에서 검색 후 노트, 페이지 클릭하면 노트가 열리고 노트패널이 아니라 에디터로 가야 함 
        if (activeViewInMobile == 'editor') {
            queryParams['activeViewInMobile'] = 'editor'; 
        } else {
            delete queryParams['activeViewInMobile']; 
        }
    
        _log('navigateUrlToNote queryParams =>', queryParams);

        this.router.navigate([url], { queryParams: queryParams });
    }

    navigateToViewMode(viewMode: NoteViewMode) {
        _flog(this.navigateToViewMode, arguments);
        this.currEditViewMode = viewMode; // 그림일기에서 app배경을 달력과 에디터가 다르게 하려는 임시코드

        let url: string = this.router.url;
        url = url.split('?')[0];

        // set noteKey
        const _queryParams = this.activeRoute.snapshot.queryParams;
        _log('navigateToViewMode queryParams =>', _queryParams);
        let queryParams = Object.assign({}, _queryParams);

        // 쿼리를 추가 하는 것인데 editType없을때도 실행되서 문제가 되서 수정 함
        if (_queryParams['editType'] && _queryParams['editItemKey']) {
            Object.assign(queryParams, { editViewMode: viewMode });
            //_log('navigateToViewMode queryParams =>', queryParams);
            this.router.navigate([url], { queryParams: queryParams });
        }
    }

    // viewType : static, note, product
    // viewItemKey : static -> introduct, tips

    navigateUrlToPresentation(viewType: NoteEditorPresentationViewType, viewItemKey: string, viewPageKey?: string, isClickable: boolean = true) {
        _flog(this.navigateUrlToPresentation, arguments);
        let url: string = this.router.url;
        url = url.split('?')[0];
        //activeRoute
        const _queryParams = this.activeRoute.snapshot.queryParams;
        _log('navigateUrlToPresentation queryParams =>', _queryParams);
        let queryParams = Object.assign({}, _queryParams);
        Object.assign(queryParams, { viewType: viewType, viewItemKey: viewItemKey, viewPageKey: viewPageKey, isClickable: isClickable });
        _log('navigateUrlToPresentation queryParams =>', queryParams);

        this.router.navigate([url], { queryParams: queryParams });
    }

    // 쿼리파람을 유지하고 이동한다. 쿼리파람에 노트에디터 정보가 있는데 이게 사라지면 노트가 닫히기 때문에
    navigateWithoutQueryParams(url: string) {
        this.router.navigate([url], { queryParams: this.activeRoute.snapshot.queryParams });
    }

    /// locationParams를 지우는데 ??
    navigateUrlClosePanel() {
        let url: string = 'main/note/home'; //this.router.url;
        url = url.split('?')[0];
        const _queryParams = this.activeRoute.snapshot.queryParams;
        let queryParams: any = Object.assign({}, _queryParams);
        if (queryParams.locationParams) {
            delete queryParams.locationParams
        }
        // 검색 후 결과로 이동 후 activeViewInMobile 주소를 제거해준다.
        if (queryParams.activeViewInMobile) {
            delete queryParams.activeViewInMobile;
        }
        _log('navigateUrlClosePanel queryParams =>', queryParams);
        this.router.navigate([url], { queryParams: queryParams });
    }

    navigateUrlClosePresentationView() {
        let url: string = this.router.url;
        url = url.split('?')[0];
        const _queryParams = this.activeRoute.snapshot.queryParams;
        let queryParams: any = Object.assign({}, _queryParams);
        if (queryParams.viewType) {
            delete queryParams.viewType
        }
        if (queryParams.viewItemKey) {
            delete queryParams.viewItemKey
        }
        if (queryParams.viewPageKey) {
            delete queryParams.viewPageKey
        }
        this.router.navigate([url], { queryParams: queryParams });
    }
    // navigateBackFromNoteEditor() {
    //     const currUrl = this.router.url;
    //     _slog('navigateBackFromNoteEditor currUrl =>', currUrl);
    //     let urls = currUrl.split('?');
    //     if (urls.length > 1) {
    //         if (urls[0] == '/main/notes/home' || urls[0] == '/main/search') {
    //             this.router.navigateByUrl(urls[0]);
    //             return;
    //         }
    //     }
    // }


    // queryparams 제거
    navigateUrlCloseNote() {
        let url: string = this.router.url;
        url = url.split('?')[0];
        const _queryParams = this.activeRoute.snapshot.queryParams;
        let queryParams: any = Object.assign({}, _queryParams);
        if (queryParams.editType) {
            delete queryParams.editType;
        }
        if (queryParams.editItemKey) {
            delete queryParams.editItemKey;
        }
        // if (queryParams.editItemKey) {
        //     delete queryParams.editItemKey;
        // }
        if (queryParams.pageKey) {
            delete queryParams.pageKey;
        }
        if (queryParams.editViewMode) {
            delete queryParams.editViewMode;
        }

        this.router.navigate([url], { queryParams: queryParams });
    }

    // 회원가입 후 불림
    async _afterJoinMemberProcess(userId: string) {

        // !! 싱글노트앱은 여기를 실행하지 않는다. /////////////////////////////////////////////////////////
        // if (this.isSingleNoteApp()) { return; }

        // #promotionPopup show
        // setTimeout(() => {
        //     this.events.fire(AppEvent.popup.show);
        // }, 1000);
        // defaut product download
        // try {
        //     // 기본 속지 다운로드
        //     this.alertService.toast('기본속지와 스티커를 다운로드 합니다. 잠시만 기다려주세요.');
        //     let defaultProductKeys = environment.defalutProductKeys;
        //     for (let productKey of defaultProductKeys) {
        //         await this.notes.api.downloadByProductKey(productKey, userId, true);
        //     }
        //     // 다운로드 완료 후 promise를 주지 않기 때문에 지연 해줌.
        //     CFHelper.fn.intervalCall(() => {
        //         this.events.fire(AppEvent.store.download);
        //     }, 2 * 60 * 1000, 15 * 1000);

        //     this.alertService.toast('다운로드가 완료 되었습니다. 이제 새로운 노트를 만들어보세요.');
        // } catch (e) {
        //     this.alertService.toast('다운로드에 문제가 발생하였습니다.');
        // }
    }

    /* -------------------------------------------------------------------------- */
    /*                                 #calc #box                                 */
    /* -------------------------------------------------------------------------- */

    /* -------------------------------------------------------------------------- */
    calcItemWidth(_containerWidth: number, itemMinWidth: number = 113, minCol: number = 3, thumbPadding: number = 22, horiPadding: number = 20) {
        // gridItemWidth = 113 고정값. 넣어주는 곳 없음.
        // 360px 기준 / 3줄 기준 / 113px * 3 = 339px 여백없이
        //let borderWidth: number = 10 * 2; // // 양끝에 10px 씩 여백 20px
        let width: number = itemMinWidth;
        let containerWidth: number = _containerWidth - horiPadding;

        let col = Math.floor(containerWidth / itemMinWidth); // floor 버림 
        if (col < 3 && col < minCol) {
            //if (col < minCol ) {
            col = minCol;
            width = Math.floor(containerWidth / col - thumbPadding);
            //} else {
            //    width = 
            //}
        } else {
            width = itemMinWidth + (containerWidth % itemMinWidth) / col - thumbPadding;
        }
        _log('calcItemSize width, col =>', width, col);
        return Math.floor(width);
    }

    /*
    date: 7
    dayCountInMonth: 31
    dayName: "목"
    lastDateOfPrevMonth: 29
    month: 3
    weekOfFirstDay: 5
    year: 2024,
    weekCount: 6
    */

    // 이건 모바일인데 데스크탑에서는??


    calcCalendarItemSize(dateMonth: Date, widthDelta: number, heightDelta: number, 
        gridPaddings = { top: 0, left: 0, right: 0, bottom: 0 },
        containerWidth?: number, containerHeight?: number, 
        forceStrechFit: boolean = false, 
        forceVertMode: boolean = false, 
        itemRate?: number) {

        let calInfo = CFHelper.date.calendarInfo(dateMonth);
        let weekCount = calInfo.weekCount;

        // 화면크기
        let _screenWidth = containerWidth ? containerWidth : window.innerWidth;
        let _screenHeight = containerHeight ? containerHeight : this.mainContainerHeight;

        // 여백을 뺀 크기 
        let _containerWidth: number = _screenWidth - widthDelta;
        let _containerHeight: number = _screenHeight - heightDelta;
        let containerRate: number = _containerHeight / _containerWidth;
       
        // 달력의 가로세로비 -> 셀의 가로세로비 -> 실제 달력의 가로세로비
        let isVertViewMode = containerRate >= 0.9 || forceVertMode; // window.innerHeight > window.innerWidth;
        _log('calcCalendarItemSize containerWidth, containerHeight, _containerWidth, _containerHeight, widthDelta, heightDelta, containerRate, isVertViewMode =>',
            containerWidth, containerHeight, _containerWidth, _containerHeight, widthDelta, heightDelta, containerRate, isVertViewMode);

        // calendar의 가로/세로비를 구한다. 
        if (itemRate) {
            // itemRate는 5주기준으로 한다. 6주일때 조정해줘야 한다.
            if (weekCount > 5) {
                itemRate = Math.round(itemRate * 5 / 6 * 100) / 100;
            }
        } else {
            if (isVertViewMode) {
                itemRate = weekCount > 5 ? 1.53 : 1.835; // 세로인 경우 배율을 고려할 필요가 없음..
                //itemRate = 1.6;
            } else {
                itemRate = weekCount > 5 ? 0.75 : 0.9;  // 속지 비율이 0.9이니 속지 비율이 맞춤
            }
        }

        ////////////////////////////////////  
        // if (this.appBuildConfig.noteTemplate && this.appBuildConfig.noteTemplate.isCalendarFixedRatio) {
        //     itemRate = this.appBuildConfig.noteTemplate.calendarRatio;
        // }
        /////////////////////////////////////

        let calHeight = (_containerWidth / 7) * itemRate * weekCount;
        let calRate = calHeight / _containerWidth;

        // 여기서 실제 가로세로비 다시 계산
        isVertViewMode = calRate > 1;

        _log('calcCalendarItemSize itemRate, weekCount, calHeight, calRate, isVertViewMode =>',
            itemRate, weekCount, calHeight, calRate, isVertViewMode);

        let itemSize: any;
        let calendarWidth: number = 0;
        if (containerRate > calRate) {
            _log('calcCalendarItemSize 가로핏');
            // 가로핏
            let itemWidth = (_containerWidth - _containerWidth * gridPaddings.left -
                _containerWidth * gridPaddings.right) / 7;
            itemSize = { width: itemWidth, height: itemWidth * itemRate };
            calendarWidth = _containerWidth;
        } else {
            _log('calcCalendarItemSize 세로핏');
            // 세로핏
            let itemHeight = (_containerHeight - _containerHeight * gridPaddings.top - _containerHeight * gridPaddings.bottom) / weekCount;
            itemSize = { width: itemHeight / itemRate, height: itemHeight }
            // 정확한 컨터이너 가로 길이를 알수 없다. 
            let containerW = (itemHeight / itemRate) * 7;
            calendarWidth = itemSize.width * 7 + containerW * gridPaddings.left + containerW * gridPaddings.right;
        }
        itemSize['calendarWidth'] = calendarWidth;

        // 가로핏일때 가로길이를 강제로 맞춰준다.
        if (forceStrechFit) {
            itemSize['calendarWidth'] = _containerWidth;
            let itemWidth = (_containerWidth - _containerWidth * gridPaddings.left -
                _containerWidth * gridPaddings.right) / 7;
            itemSize['width'] = itemWidth;
        }

        // 비율을 px로 변환
        itemSize['gridPaddings'] = gridPaddings;
        itemSize['paddingTop'] = isVertViewMode ? calendarWidth * 0.083 : calendarWidth * 0.065;

        // 달력의 길이를 기준으로 계산하고 max 26px로 잡아줌
        itemSize['fontSize'] = Math.round((itemSize.width + itemSize.height) * 0.12);

        // 달력의 기로세로비를 내려준다. 외부에서 계산하면 안맞음 => 그림달력의 경우 강제 가로모드이기 때문에
        itemSize['isVertViewMode'] = isVertViewMode;

        _log('calcCalendarItemSize itemSize =>', itemSize, containerWidth, gridPaddings);
        return itemSize;
    }
    // calc image object fit cover size 
    calcFitSizeWithObjectFitCover(boxWidth: number, boxHeight: number, srcWidth: number, srcHeight: number) {
        let boxWHRate = boxWidth / boxHeight;
        let srcWHRate = srcWidth / srcHeight;
        let fitWidth, fitHeight;

        if (boxWHRate > srcWHRate) {
            fitHeight = boxHeight;
            fitWidth = Math.round(fitHeight * srcWidth / srcHeight);    // x : 111 = w : h  
        } else {
            fitWidth = boxWidth;
            fitHeight = Math.round(fitWidth * srcHeight / srcWidth);
        }
        return { width: fitWidth, height: fitHeight }
    }

    // notice
    public hasNewNotice: boolean = false;
    public _hasNewNoticeOfCategory: Record<string, boolean> = {};
    public hasNewNoticeOfCategory(category: NoticeCategory | string) {
        return this._hasNewNoticeOfCategory[category];
    }
    async updateNewNotice(isReload: boolean = false) {
        _flog(this.updateNewNotice, arguments);
        let member;
        if (isReload) {
            member = await this.authService.updateMember();
        } else {
            member = await this.getSafeMember();
        }
        _valid(member);
        _log('updateNewNotice member =>', member);
        if (!member) {
            this.hasNewNotice = false;
            return;
        }
        this._hasNewNoticeOfCategory[NoticeCategory.public] = await this.noticeStore.hasNewNotice(member, this.appBuildConfig.app.id, NoticeCategory.public);

        _log('updateNewNotice  _hasNewNoticeOfCategory =>', this._hasNewNoticeOfCategory);

        // 3가지 중에서 한개로도 true면 true
        this.hasNewNotice = this._hasNewNoticeOfCategory[NoticeCategory.public];
        _log('updateNewNotice  hasNewNotice =>', this.hasNewNotice);

        this.events.fire(AppEvent.app.updated.hasNewNotice, this.hasNewNotice);
    }

    getAllBadgeCount() {
        return { notice: this.hasNewNotice ? 1 : 0 };
    }

    // dataUrl 다운로드
    downloadImageWithDataUrl(blobUrl: string) {
        _flog(this.downloadImageWithDataUrl, arguments);
        this._downloadImageWithDataUrl(blobUrl);
    }

    private async _fetchAsBase64(url: string): Promise<string> {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject('Error converting blob to base64');
            reader.readAsDataURL(blob);
        });
    }

    async downloadImageWithUrl(url: string, fileName: string) {
        try {
            if (this.isIOSApp()) {
                let params: IAppWebBridgeEventParams = {
                    data: url, // data:image/png;base64,.... 형태로 전달
                    userId: '',
                    key: '',
                    data2: fileName
                }
                this.sendCommandToApp(AppCommand.app.saveAsImageWithUrl, params);
            } else {
                const base64Data = await this._fetchAsBase64(url);
                this._downloadImageWithDataUrl(base64Data, fileName);
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    }

    // url 열기
    openUrl(url: string) {
        if (this.isIOSApp()) {
            let params: IAppWebBridgeEventParams = {
                data: url,
                userId: '',
                key: ''
            }
            this.sendCommandToApp(AppCommand.app.openUrl, params);
        } else {
            // 외부 창 열기
            window.open(url, "_blank");
        }
    }

    // url 다운로드
    // async downloadImageWithUrl(url: string, fileName: string) {
    //     _flog(this.downloadImageWithUrl, arguments);
    //     try {
    //         const response = await fetch(url, { mode: 'cors' });
    //         const blob = await response.blob();
    //         const blobUrl = URL.createObjectURL(blob);            
    //         this._downloadImageWithDataUrl(blobUrl, fileName);
    //         // URL.revokeObjectURL(blobUrl);  // 메모리 해제
    //     } catch (error) {
    //         console.error('Error downloading image:', error);
    //     }
    // }

    _downloadImageWithDataUrl(blobUrl: string, fileName?: string) {
        if (this.isIOSApp()) {
            let params: IAppWebBridgeEventParams = {
                data: blobUrl,
                userId: '',
                key: '',
                data2: fileName
            }
            this.sendCommandToApp(AppCommand.app.saveAsImage, params);
        } else {
            const downloadLink = document.createElement('a');
            document.body.appendChild(downloadLink);
            downloadLink.href = blobUrl;
            downloadLink.target = '_self';
            downloadLink.download = (fileName ? fileName : Date.now()) + '.png';
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }

    // firestorage에 downloadUrl이어야 함 
    async annotateImage(downloadUrl: string): Promise<NPVisonImageAnnotationData | undefined> {
        const app = initializeApp(environment.firebaseConfig);
        const functions = getFunctions(app, FBFunctionsRegion);
        const func_annotateImage = httpsCallable(functions, 'annotateImage');

        let result: any;
        try {
            let imageUri = this._convertFirebaseUrlToGcsUrl(downloadUrl);
            _log('annotateImage imageUri =>', imageUri);
            if (!imageUri) { return; }

            let params = {
                image: { source: { imageUri: imageUri } },
                features: [{ type: "TEXT_DETECTION" }, { type: "LABEL_DETECTION" }, { type: "LANDMARK_DETECTION" }],
                imageContext: { languageHints: ["ko", "en"] }
            };

            let resp = await func_annotateImage(params);
            result = (resp.data) as any;
            _log('annotateImage result =>', result);
        } catch (e) {
            _log('annotateImage error =>', e);
            return;
        }
        if (!result) {
            _log('annotateImage error2 =>');
            return;
        }

        let data: NPVisonImageAnnotationData = {
            text: result.fullTextAnnotation?.text,
            labels: result.labelAnnotations // drawing은 라벨 사용 안함 
        }
        _log('annotateImage data =>', data);
        return data;
    }

    private _convertFirebaseUrlToGcsUrl(firebaseUrl: string): string {
        _flog(this._convertFirebaseUrlToGcsUrl, arguments);
        try {
            // URL 객체 생성
            const url = new URL(firebaseUrl);

            // Firebase Storage URL인지 확인
            if (!url.hostname.includes("firebasestorage.googleapis.com")) {
                return ""; // 변환 실패 시 빈 문자열 반환
            }

            // 버킷 이름 추출 ("/v0/b/{bucket-name}/o/" 구조이므로 [3]이 버킷 이름)
            const pathSegments = url.pathname.split("/");
            const bucketName = pathSegments[3]; // 올바른 버킷 이름 추출

            // 파일 경로 변환 (%2F → / 디코딩)
            const objectPath = decodeURIComponent(url.pathname.split("/o/")[1]);

            // GCS 형식의 imageUri 반환
            return `gs://${bucketName}/${objectPath}`;
        } catch {
            return ""; // 변환 실패 시 빈 문자열 반환
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                    #skin                                   */
    /* -------------------------------------------------------------------------- */
    getSkinFontStyleObject(font?: CalSkinFont, itemSize?: { width: number, height: number }) {
        if (!font) { return {}; }
        let isMobileViewMode: boolean = this.isMobileViewMode();
        let _font = isMobileViewMode ? Object.assign({}, font.default, font.mobile) : font.default;
        let obj: any = {};
        if (_font.familyName) { obj['font-family'] = _font.familyName; }    
        if (_font.weight) { obj['font-weight'] = _font.weight; }    
        if (_font.color) { obj['color'] = _font.color; }
        // font size
        if (_font.sizeVmax !== undefined && _font.sizeVmax !== null) { obj['font-size'] = _font.sizeVmax + 'vw'; }
        if (_font.sizeItemRate!== undefined && _font.sizeItemRate!== null && itemSize) { 
            _valid(itemSize);
            //obj['font-size'] = Math.round( itemSize.width * itemSize.height * _font.sizeItemRate * 100) / 100 + 'px';
            obj['font-size'] = Math.round((itemSize.width + itemSize.height) * _font.sizeItemRate) + 'px';
        }
        if (_font.letterSpacing !== undefined && _font.letterSpacing !== null) { obj['letter-spacing'] = _font.letterSpacing; } 
        //_log('getSkinFontStyleObject obj =>', obj);
        return obj;
    }

    getSkinFontStyleValue(font: CalSkinFont, property: string) {
        let styleObj = this.getSkinFontStyleObject(font);
        return styleObj[property];
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #notice                                  */
    /* -------------------------------------------------------------------------- */
    async loadEventNotice() {
        let member = await this.getSafeMember();
        _valid(member);
        if (!member) { return; }
        return this.noticeStore.getEventNotice(member, this.appBuildConfig.app.id as AppIds);
    }

    async doneEventNoticeAsync(eventId: EventNoticeIds) {
        let member = await this.getSafeMember();
        _valid(member);
        if (!member) { return; }
        return this.noticeStore.doneEventNotice(eventId, member, this.appBuildConfig.app.id as AppIds);
    }

    isAvailableEventNotice(eventId: EventNoticeIds) {
        let member = this.getMemberSnapshot();
        _valid(member);
        if (!member) { return; }
        return this.noticeStore.isAvailableEventNotice(eventId, member, this.appBuildConfig.app.id as AppIds);
    }


    /* -------------------------------------------------------------------------- */
    /*                                   #review                                  */
    /* -------------------------------------------------------------------------- */

    async doneReqeustReviewAsync() {
        let member = await this.getSafeMember();
        _valid(member);
        if (!member) { return; }
        return this.noticeStore.doneReqeustReview( member, this.appBuildConfig.app.id as AppIds);
    }

    isAvailableRequestReview() {
        let member = this.getMemberSnapshot();
        _valid(member);
        if (!member) { return; }
        return this.noticeStore.isAvailableRequestReview(member, this.appBuildConfig.app.id as AppIds);
    }

}
