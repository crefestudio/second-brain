import { NoteViewMode, NPNote, NPNoteContent, NPPage } from 'src/lib/fb-noteapi/cf-noteapi';

export enum AppIds {
    journal = 'journal',
    drawingdiary = 'drawingdiary',
    drawingcalendar = 'drawingcalendar',
    minddiary = 'minddiary',
    esdiary = 'esdiary'
}

export enum AppEventType {
    command = 'command',
    event = 'event',
    progress = 'progress'
}

export interface IAppWebBridgeEvent {
    eventType: string,
    eventName: string,
    params?: IAppWebBridgeEventParams      // swiftUI에서 any type을 사용할 수 없음, string으로 받아서 다시 파싱하기로 함
}

export interface IAppWebBridgeEventParams {
    key: string;
    data: string;
    userId: string;
    data2?: string;
    key2?: string;
}

export enum Device {
    desktop = 'desktop',
    mobile = 'mobile',
    tablet = 'tablet'
}

export enum LoadingState {
    ready = 'ready',
    loading = 'loading',
    complete = 'complete',
    empty = 'empty'
}

export interface INoteUrlQueryParams {
    pageKey?: string;
    editViewMode?: NoteViewMode;
    passwordKey?: string;
    activeViewInMobile?: string; // editor, notePanel
    isRefresh?: boolean;
}

// export interface AppCommandNoteOpenParams {
//     // noteKey: string,
//     pageKey: string, 
//     editViewMode: NoteViewMode, 
//     // passwordKey?: string;
//     hideNotePanelInMobileViewMode?: boolean 
// }

export enum ReqeustGPSType {
    pagePos = 'pagePos',
    currPos = 'currPos'
}

export interface AppEventCalendarViewUpdateDateParams {
    page: NPPage,
    newDate: Date,
    oldDate?: Date
}


export interface AppCommandNotePresentationOpenParams {
    imageType: string;
    images: Array<any>;
    currIndex: number;
    // background?: string;
}

export interface AppCommandNotePresentionPagesOpenParams {
    note: NPNote,
    noteContent: NPNoteContent,
    pages?: NPPage[],
    activePageKey?: string
}

export enum PDFPageFormat {
    A0 = "A0",
    A1 = "A1",
    A2 = "A2",
    A3 = "A3",
    A4 = "A4",
    A5 = "A5",
    originalSize = 'originalSize'
}

export interface AppCommandNoteSaveAsPDFParams {
    note: NPNote,
    pageFormat: PDFPageFormat,
    year?: string;
    Month?: string;
}


// command : global적인 어떤 행위를 하라는 명령
// 3depth이상 정의 하면 안됩니다. / 필요하면 수정해줘야 함
export const AppCommand = {
    app: {
        //////////////////////////////// 웹 => 앱 
        update: 'app.update',   // 앱을 업데이트 하라
        exit: 'app.exit',       // 앱을 종료 하라
        purchase: 'app.purchase',   // 구매 하기
        review: 'app.review',       // 리뷰 쓰러 가기
        appStore: 'app.appStore',   // 앱스토어로 이동
        restorePurchases: 'app.restorePurchases',
        enterEditDrawingInputBox: 'app.enterEditDrawingInputBox', // 앱에 그리기 캔버스를 띄움
        syncLogin: 'app.syncLogin',     // 웹이 로그인 된 후 앱을 로그인 하라
        syncLogout: 'app.syncLogout',   // 웹이 로그아웃 된 후 앱을 로그아웃 하라
        saveAsImage: 'app.saveAsImage', // dataUrl, 페이지 저장에 사용
        saveAsImageWithUrl: 'app.saveAsImageWithUrl',     // url을 지접 전달, 미디어에서 이미지 저장을 위해 사용  
        saveAsFileWithUrl: 'app.saveAsFileWithUrl',     // url을 지접 전달, 미디어에서 PDF 저장을 위해 사용  
        requestGPS: 'app.requestGPS',
        openUrl: 'app.openUrl',

        //////////////////////////////// 앱 => 웹 
        registFcmToken: 'app.registFcmToken', // 유저의 fcm 토큰을 기록 함 

        //////////////////////////////// 웹끼리
        //popupPremiumNoti: 'app.popupPremiumNoti' // 이용기간 만료 팝업 띄우기, 이건 앱에 보내는 게 아닌데
    },
    account: {
        logout: 'account.logout'
    },
    item: {
        open: 'item.open',
        use: 'item.use', //아이템을 사용할 때 template은 노트 만들기, sticker 추가
        update: {
            name: 'item.update.name',
        }
    },
    // editor냐 note냐 애매함 / note값 자체를 바꾸는 거면 note, 현재 UI상태를 바꾸는 거면 editor?? 그래도 애매함
    editor: {
        undo: 'editor.undo',
        redo: 'editor.redo',
        paste: 'editor.paste',
        makePagePreview: 'editor.makePagePreview',
        viewMode: 'editor.viewMode'
    },
    note: {
        create: 'note.create',
        open: 'note.open',
        refresh: 'note.refresh',
        lock: 'note.lock',
        close: 'note.close',
        trash: 'note.trash',
        preview: 'note.preview',
        save: 'note.save',      // 노트 저장 (지금은 사용안함 )
        emptyTrash: 'note.emptyTrash',
        bookmark: 'note.bookmark',
        permanentlyDelete: 'note.permanentlyDelete', // 영구삭제
        restore: 'note.restore', // 복원
        setting: 'note.setting',
        share: 'note.share',
        info: 'note.info',
        saveAsPDF: 'note.saveAsPDF',            // PDF로 저장하기 ** 팝업에서 이미 옵션 설정이 된 후
        skin: 'note.skin', // 스킨 적용
        page: {
            create: 'note.page.create',
            close: 'note.page.close',
            prev: 'note.page.prev',
            next: 'note.page.next',
            new: 'note.page.new',                   // 새로운 페이지를 추가
            duplicate: 'note.page.duplicate',
            delete: 'note.page.delete',
            copy: 'note.page.copy',
            cut: 'note.page.cut',
            paste: 'note.page.paste',
            info: 'note.page.info',
            add: 'note.page.add',
            saveas: 'note.page.saveas',          // 페이지 저장, 지금은 이미지로 저장
            changeBgColor: 'note.page.changeBgColor',
            saveImage: 'note.page.saveImage',    // 미사용
            public: 'note.page.public',
            primaryOfDay: 'note.page.primaryOfDay'        // 대표 페이지 (하루단위, 달력에 표시)
        },
        add: {
            text: 'note.add.text',
            image: 'note.add.image',
            sticker: 'note.add.sticker'
        },
        presentation: {
            open: 'note.presentation.open',
            close: 'note.presentation.close',
            pages: {
                open: 'note.presention.pages.open', // 기본 파람이 아니라 노트, 노트컨텐츠의 템플릿, 페이지들로 함
                close: 'note.presention.pages.close',
            }
        },
        object: 'note.object',           // 요소 추가 창 띄우기 !! 수정필요 => 이름이 모호함
        // notePanel: {
        //     show: 'note.notePanel.show',
        //     hide: 'note.notePanel.hide'
        // }
    },
    page: {
        update: {
            date: 'page.update.date',
            gps: 'page.update.gps'
        }
    },
    template: {
        create: 'template.create',      // 템플릿 생성
        open: 'template.open',          // 템플릿 열기
        close: 'template.close',        // 템플릿 닫기
        use: 'template.use',            // 템플릿 사용 : 해당 템플릿으로 새로운 노트를 만든다.
        trash: 'template.trash',        // 템플릿 삭제
        info: 'template.info',
        preview: 'template.preview',    // 준비중, 템플릿 미리보기
        object: 'template.object',      // 템플릿 요소 추가 창 띄우기
        setting: 'template.setting',
        publish: 'template.publish',
        move: 'template.move',          // 템플릭 팩에서 꺼내기
        update: 'template.update'       // 외부에서 템플릿을 수정할 때 
    },
    templatePack: {
        create: 'templatePack.create',
        add: 'templatePack.add',
        open: 'templatePack.open',
        close: 'templatePack.close',
        trash: 'templatePack.trash',
        update: {
            cover: 'templatePack.update.cover',
        },
        publish: 'templatePack.publish'
    },
    store: {
        download: 'store.download'
    },
    stickerPack: {
        create: 'stickerPack.create',       // 스티커 생성 팝업
        open: 'stickerPack.open',
        close: 'stickerPack.close',
        trash: 'stickerPack.trash',
        update: {
            cover: 'stickerPack.update.cover'
        },
        publish: 'stickerPack.publish'
    },
    sticker: {
        create: 'sticker.create',   // 스티커 추가 하기
        delete: 'sticker.delete',    // 스티커 삭제 하기
    },
    menu: {
        popup: 'menu.popup',        // 메뉴를 띄울때 
    },
    sidebar: {
        open: 'sidebar.open',     // 사이드바 열기
        close: 'sidebar.close'
    },
    activityBar: {
        toggle: 'activityBar.toggle'
    },
    object: {
        cut: 'object.cut',
        copy: 'object.copy',
        paste: 'object.paste',
        remove: 'object.remove',
        order: {
            front: 'object.order.front',
            back: 'object.order.back',
            prev: 'object.order.prev',
            next: 'object.order.next'
        },
        text: {
            lineHeight: 'object.text.lineHeight',
            charSpacing: 'object.text.charSpacing',
        },
        shift: {
            up: 'object.shift.up',
            down: 'object.shift.down',
            left: 'object.shift.left',
            right: 'object.shift.right',
            up5: 'object.shift.up5',
            down5: 'object.shift.down5',
            left5: 'object.shift.left5',
            right5: 'object.shift.right5'
        },
        persistence: 'object.persistence'
    },
    password: {
        popup: 'password.popup'
    },
    popupPanel: {
        notes: 'popupPanel.notes',
        bookmark: 'popupPanel.bookmark',
        store: 'popupPanel.store',          // 스토어로 이동
        feed: 'popupPanel.feed',            // 피드로 이동
        notice: 'popupPanel.notice',        // 알림으로 이동
        search: 'popupPanel.search',        // 검색으로 이동
        profile: 'popupPanel.profile',      // 프로필로 이동      
        info: 'popupPanel.info',            // 앱정보로 이동 
        setting: 'popupPanel.setting',          // 앱설정으로 이동 
        menu: 'popupPanel.menu',          // 앱설정으로 이동 
        downloadSticker: 'popupPanel.downloadSticker', //
        datetimeObject: 'popupPanel.datetimeObject'
    },
    popup: {
        purchase: 'popup.purchase',     // 구매하기 팝업 띄움
        makePDF: 'popup.makePDF',
        review: 'popup.review',    // 리뷰 쓰기 팝업 띄움
        requestReview: 'popup.requestReview'
    },
    bottomSheet: {
        close: 'bottomSheet.close'
    },
    calendarView: {
        updateDate: 'calendarView.updateDate'
    },
    media: {
        open: 'media.open', // 실제 노트에 미디어가 있는 해당 페이지를 연다.
        download: 'media.download',   // 내려받기
        show: 'medai.show'  // 원본보기 
    },
    notice: {
        openEventNotice: 'notice.openEventNotice'    
    }
}

// 특정 사용자 : guest, developer, premium
// 모든 사용자 : member는 모두를 뜻함
// true, false, undefined 
// 기본 값이 없고 undefined일 경우는 권한 쿼리를 사용하지 말것
// 권한은 명시적으로 선언한것만 사용함
export enum AppMemberType {
    member = 'member',
    premiumMember = 'premiumMember',
    //guest = 'guest',
    //developer = 'developer'
}

// export interface AppAuthType {
//     appId: string;
//     command: string;
//     auth: {
//         member?: boolean,
//         premiumMember?: boolean,
//         // guest?: boolean,
//         // developer?: boolean
//     }
// }

// 지금은 premium제한에만 사용하기 때문에 바로 premium popup을 띄움 
// 다른 용도로 권한 체크를 할꺼면 이후 변경이 필요함
//export const AppCommandAuths: Array<AppAuthType> = [
    // {
    //     appId: 'all',
    //     command: AppCommand.note.saveAsPDF,
    //     auth: {
    //         member: false,
    //         premiumMember: true
    //     }
    // },
    // {
    //     appId: 'all',
    //     command: AppCommand.note.,
    //     auth: {
    //         member: false,
    //         premiumMember: true
    //     }
    // }
//]

// guest의 권한 제한 
export const AppCommandGuestAuth: any = {
    // 'item.update.name': { // 안됨
    //     guest: false,
    // },
    'note.trash': {
        guest: false
    },
    'note.create': {
        guest: false
    },
    'note.emptyTrash': {
        guest: false
    },
    'note.permanentlyDelete': {
        guest: false
    },
    'note.restore': {
        guest: false
    },
    'note.setting': {
        guest: false
    },
    // 'note.page.new': { // 안됨
    //     guest: false
    // },
    // 'note.page.duplicate': { // 안됨
    //     guest: false
    // },
    'note.page.delete': { // 안됨
        guest: false
    },
    'note.page.saveas': { // 안됨
        guest: false
    },
    'note.page.public': { // 안됨
        guest: false
    },
    // 'note.page.copy': { // 안됨
    //     guest: false
    // },
    // 'note.page.cut': { // 안됨
    //     guest: false
    // },
    'note.page.paste': {
        guest: false
    },
    'object.remove': {
        guest: false
    },
    'object.cut': {
        guest: false
    },
    // 'template.create': { // 안됨
    //     guest: false
    // },
    // 'template.open': { // 안됨
    //     guest: false
    // },
    // 'template.close': { // 안됨
    //     guest: false
    // },
    'template.use': {   // 템플릿 사용 : 해당 템플릿으로 새로운 노트를 만든다.
        guest: false
    },
    'template.trash': {
        guest: false
    },
    'template.info': {
        guest: false
    },
    'template.preview': {
        guest: false
    },
    'template.object': {
        guest: false
    },
    'template.setting': {
        guest: false
    },
    'template.publish': {
        guest: false
    },
    'template.move': {
        guest: false
    },
    'template.update': {
        guest: false
    },
    'templatePack.create': {
        guest: false
    },
    'templatePack.add': {
        guest: false
    },
    'templatePack.open': {
        guest: false
    },
    'templatePack.close': {
        guest: false
    },
    'templatePack.trash': {
        guest: false
    },
    'templatePack.update.cover': {
        guest: false
    },
    'templatePack.publish': {
        guest: false
    },
    // 'store.download': { // 사용안함 
    //     guest: false
    // },
    'stickerPack.create': {
        guest: false
    },
    'stickerPack.open': {
        guest: false
    },
    'stickerPack.close': {
        guest: false
    },
    'stickerPack.trash': {
        guest: false
    },
    'stickerPack.update.cover': {
        guest: false
    },
    'stickerPack.publish': {
        guest: false
    },
    'sticker.create': {
        guest: false
    },
    'sticker.delete': {
        guest: false
    }
}



/* ------------------------------- app #notice ------------------------------ */
export interface IAppStateNotice {
    id: string,
    state: string;
    message: string;
    icon: string;
    displayTime?: number;
}

export const AppProgress = {
    appReady: {
        ing: {
            id: 'appReady',
            state: 'ing',
            message: '앱 시작을 준비중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'appReady',
            state: 'complete',
            message: '앱 시작 준비가 완료되었습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'appReady',
            state: 'fail',
            message: '앱 시작에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    loadPageList: {
        ing: {
            id: 'loadPageList',
            state: 'ing',
            message: '글 목록을 가져오는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'loadPageList',
            state: 'complete',
            message: '글 목록 가져오기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'loadPageList',
            state: 'fail',
            message: '글 목록 가져오기에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    // note update
    noteUpdate: {
        ing: {
            id: 'noteUpdate',
            state: 'ing',
            message: '변경 내용을 저장 중',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'noteUpdate',
            state: 'complete',
            message: '변경 내용이 모두 저장됨',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'noteUpdate',
            state: 'fail',
            message: '변경 내용 저장 실패',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        }
    },
    // new note
    newNote: {
        ing: {
            id: 'newNote',
            state: 'ing',
            message: '새 노트를 만드는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'newNote',
            state: 'complete',
            message: '새 노트를 만들었습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'newNote',
            state: 'fail',
            message: '새 노트를 만드는 중 오류가 발생했습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    // new sticker
    newSticker: {
        ing: {
            id: 'newSticker',
            state: 'ing',
            message: '스티커를 만드는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'newSticker',
            state: 'complete',
            message: '스티커를 만들었습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'newSticker',
            state: 'fail',
            message: '스티커를 만드는 중 오류가 발생했습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    // new template
    newTemplate: {
        ing: {
            id: 'newTemplate',
            state: 'ing',
            message: '새 템플릿을 만드는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'newTemplate',
            state: 'complete',
            message: '새 템플릿을 만들었습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'newTemplate',
            state: 'fail',
            message: '새 템플릿을 만드는 중 오류가 발생했습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    // note load
    openNote: {
        ing: {
            id: 'openNote',
            state: 'ing',
            message: '노트를 읽는중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'openNote',
            state: 'complete',
            message: '노트 읽기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'openNote',
            state: 'fail',
            message: '노트 읽기에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    loadPage: {
        ing: {
            id: 'loadPage',
            state: 'ing',
            message: '페이지를 읽는중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'loadPage',
            state: 'complete',
            message: '페이지 읽기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'loadPage',
            state: 'fail',
            message: '페이지 읽기에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    openTemplate: {
        ing: {
            id: 'openTemplate',
            state: 'ing',
            message: '템플릿을 로딩중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'openTemplate',
            state: 'complete',
            message: '템플릿 로드를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'openTemplate',
            state: 'fail',
            message: '템플릿 로딩에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    openPreview: {
        ing: {
            id: 'openPreview',
            state: 'ing',
            message: '전체 보기 화면을 로딩중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'openPreview',
            state: 'complete',
            message: '전체 보기 화면 로드를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'openPreview',
            state: 'fail',
            message: '전체 보기 화면 로딩에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    loadNoteList: {
        ing: {
            id: 'loadNoteList',
            state: 'ing',
            message: '노트 목록을 가져오는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'loadNoteList',
            state: 'complete',
            message: '노트 목록 가져오기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'loadNoteList',
            state: 'fail',
            message: '노트 목록 가져오기에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    search: {
        ing: {
            id: 'search',
            state: 'ing',
            message: '검색중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'search',
            state: 'complete',
            message: '검색을 완료했습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'search',
            state: 'fail',
            message: '검색에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    deleteTrash: {
        ing: {
            id: 'deleteTrash',
            state: 'ing',
            message: '휴지통을 비우는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'deleteTrash',
            state: 'complete',
            message: '휴지통 비우기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'deleteTrash',
            state: 'fail',
            message: '휴지통 비우기를 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    addImageFile: {
        ing: {
            id: 'addImageFile',
            state: 'ing',
            message: '이미지 첨부 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'addImageFile',
            state: 'complete',
            message: '이미지 첨부를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'addImageFile',
            state: 'fail',
            message: '이미지 첨부를 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    openProduct: {
        ing: {
            id: 'openProduct',
            state: 'ing',
            message: '상품을 로딩중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'openProduct',
            state: 'complete',
            message: '상품 로드를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'openProduct',
            state: 'fail',
            message: '상품 로딩에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    downloadProduct: {
        ing: {
            id: 'downloadProduct',
            state: 'ing',
            message: '상품을 다운로드중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'downloadProduct',
            state: 'complete',
            message: '상품 다운로드를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'downloadProduct',
            state: 'fail',
            message: '상품 다운로드가 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    },
    saveAsPDF: {
        ing: {
            id: 'saveAsPDF',
            state: 'ing',
            message: '전자책을 만드는 중입니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg'
        },
        complete: {
            id: 'saveAsPDF',
            state: 'complete',
            message: '전자책 만들기를 완료하였습니다.',
            icon: 'assets/images/svg/ic_compatible-complete_24.svg',
            displayTime: 3000
        },
        fail: {
            id: 'saveAsPDF',
            state: 'fail',
            message: '전자책 만들기에 실패하였습니다.',
            icon: 'assets/images/svg/ic_compatible-ing_24.svg',
            displayTime: 3000
        }
    }
}

// event : 어떤 행위가 발생 후 알림
export const AppEvent = {
    app: {
        launched: 'app.launched',           // 앱이 시작될 때 발생, 웹이 reload될때는 발생하지 않음 / 업데이트 여부 판단에 사용
        // parameter로 safeAreaInsetsTop을 받음

        activated: 'app.activated',           // 앱이 빌활성 모드에서 활성으로 전환될 때 발생 / 업데이트 여부 판단에 사용  

        //webLaunched: 'app.webLaunched',     // 로딩오류 방지를 위해서 앱이 시작되었음을 알리는 이벤트를 launched, activated를 받았을 때 웹이 앱에게 응답을 보낸다.
        pressedBack: 'app.pressedBack',
        updated: {
            purchase: 'app.updated.purchase',       // IAppWebBridgeEventParams
            hasNewNotice: 'app.hasNewNotice'
        },
        exitedEditDrawingInputBox: 'app.exitedEditDrawingInputBox', // !!! 이거는 AppCommand로 옮겨야 함, 그림일기, 그림달력 때문에 아직 안함
        changedVertHoriViewMode: 'app.changedVertHoriViewMode', // 앱의 크기가 변했다. 다시 레이아웃을 조정해야 함
        scrolled: 'app.scrolled', // 앱 자체가 스크롤 될때 
        keyboardDidShow: 'app.keyboardDidShow',
        keyboardDidHide: 'app.keyboardDidHide',
        responseGPS: 'app.responseGPS', // 페이지에 gps를 등록하라는 명령에 대한 응답, 목적에 따른 요청 타입 있다.
        receiveGPSForCurrPos: 'app.receiveGPSForCurrPos', // responseGPS에 받은 것과 동일하나 현재 위치를 범용적으로 사용할 곳에서 수신한다.
    },
    item: {
        updated: {
            name: 'item.updated.name'
        }
    },
    note: {
        opened: 'note.opened',              // 노트가 열릴 때 , NPNote
        //willClose: 'note.willClose',      // 노트 닫힐 때
        closed: 'note.closed',              // 노트 닫힐 때 
        created: 'note.created',            // 노트 생성된 후                           #sync대상
        updated: {
            //page: 'note.updated.page',
            pagePosition: 'note.updated.pagePosition',
            coverImage: 'note.updated.coverImage',
            bookmark: 'note.updated.bookmark',
            pageAddMode: 'note.updated.pageAddMode', // params : isAddForward
            isLock: 'note.updated.isLock',
            isOpenFromLastPage: 'note.updated.isOpenFromLastPage',
            listType: 'note.updated.listType',
            canvasScaleFitType: 'note.updated.canvasScaleFitType',
            isShowPhotoInCalendar: 'note.updated.isShowPhotoInCalendar',
            holidayDisplayType: 'note.updated.holidayDisplayType',
            skin: 'note.updated.skin'
        },
        trashed: 'note.trashed',                // 휴지통 넣기                      #sync대상
        restoreTrashed: 'note.restoreTrashed',  // 휴지통 복원                      #sync대상
        permanentDeleted: 'note.permanentDeleted', // 노트 영구 삭제
        presentation: {
            opened: 'note.presentation.opened', // 주로 이미지용 전체 보기
            closed: 'note.presentation.closed', // 주로 이미지용 전체 보기
        }
    },
    page: {
        updated: {
            isPublic: 'page.updated.isPublic',
            date: 'page.updated.date',
            isPrimaryOfDay: 'page.updated.isPrimaryOfDay'
        },
        willDelete: 'page.willDelete',   // 페이지가 삭제 전에 이벤트가 발생함, 삭제 후 발생하면 정보가 없어서 뭘 할 수가 없음
        inserted: 'page.inserted',
        loaded: 'page.loaded'
    },
    object: {
        saved: 'object.saved',
        update: {
            //all: 'object.update.all',       // object가 수정되었다.
            color: 'object.update.color',
            stickerGroupInputBox: 'object.update.stickerGroupInputBox'
        }
    },
    template: {
        opened: 'template.opened',          // 템플릿 열기
        closed: 'template.closed',        // 템플릿 닫기
        created: 'template.created',        // 템플릿 생성      // 리스트 갱신
        deleted: 'template.deleted',        // 템플릿 삭제      // 리스트 갱신
        updated: {
            //all: 'template.updated.all',         // 템플릿 수정
            // name: 'AppEvent.item.updated.name',       // 이름                
            coverImage: 'template.updated.coverImage', // 배경이미지
            parentKey: 'template.updated.parentKey',
            //            backgroundColor: 'template.updated.backgroundColor' // 배경 색 변경
        }
    },
    store: {
        download: 'store.download'
    },
    templatePack: {
        opened: 'templatePack.opened',
        created: 'templatePack.created',
        deleted: 'templatePack.deleted',
        // updated: 'templatePack.updated'         
    },
    stickerPack: {
        opened: 'stickerPack.opened',
        created: 'stickerPack.created',
        deleted: 'stickerPack.deleted',
        updated: 'stickerPack.updated'
    },
    sticker: {
        created: 'sticker.created',
        deleted: 'sticker.deleted',
        added: 'sticker.added',    // 최근 사용 스티커 객체 생성
    },
    myStore: {
        updated: 'myStore.updated',
    },
    sidebar: {
        opened: 'sidebar.opened',   // 사이드바가 열린 후   
        closed: 'sidebar.closed'    // 사이드바가 닫힌 후
    },
    config: {
        updated: 'config.updated'
    },
    state: {
        updated: {
            penPalette: 'state.updated.penPalette',
            selectedPenIndex: 'state.updated.selectedPenIndex',
            customPalette: 'state.updated.customPalette',
            isShowPageGridSidebar: 'state.updated.isShowPageGridSidebar',
            lastOpenedNoteKey: 'state.updated.lastOpenedNoteKey'
            //gridSortOrder: 'state.updated.gridSortOrder'
        }
    },
    toolbar: {
        buttonState: 'toolbar.buttonState'
    },
    progress: 'progress',
    auth: {
        logined: 'auth.logined',
        logouted: 'auth.logouted',
        updated: 'auth.updated'
    },
    editor: {
        complatePagePreview: 'editor.complatePagePreview',
        changedViewMode: 'editor.changedViewMode',
        toggleNotePanelSidebar: 'editor.toggleNotePanelSidebar'
    },
    popup: {
        show: 'popup.show',
        hide: 'popup.hide'
    }
}


/* -------------------------------------------------------------------------- */
/*                                  #key map                                  */
/* -------------------------------------------------------------------------- */

// 여러개 있을 경우 처음 나오는것이 대표로 메뉴에 표시 됨

export const AppCurrent = {
    object: {
        selected: 'object.selected',
        notEditing: 'object.notEditing',
    },
    page: {
        selected: 'page.selected'
    },
    note: {
        selected: 'note.selected'
    },
    template: {
        selected: 'template.selected'
    },
}

// 상태의 우선순위 : 만약 동시의 상태가 존재 할때 우선순위를 높이려면 리스트를 앞으로 둠

export const AppKeyCommandMap = [
    /* ---------------------------------- #note --------------------------------- */
    { keyName: 'Ctrl+B', command: 'note.create', when: '' },
    { keyName: 'Ctrl+I', command: 'note.info', when: AppCurrent.note.selected },
    { keyName: 'Ctrl+I', command: 'template.info', when: AppCurrent.template.selected },

    /* --------------------------------- #object -------------------------------- */
    { keyName: 'Ctrl+X', command: 'object.cut', when: AppCurrent.object.selected },
    { keyName: 'Ctrl+C', command: 'object.copy', when: AppCurrent.object.selected },
    { keyName: 'Delete', command: 'object.remove', when: AppCurrent.object.selected },

    { keyName: 'ARROWLEFT', command: 'object.shift.left5', when: AppCurrent.object.selected },
    { keyName: 'ARROWRIGHT', command: 'object.shift.right5', when: AppCurrent.object.selected },
    { keyName: 'ARROWUP', command: 'object.shift.up5', when: AppCurrent.object.selected },
    { keyName: 'ARROWDOWN', command: 'object.shift.down5', when: AppCurrent.object.selected },

    { keyName: 'Shift+ARROWLEFT', command: 'object.shift.left', when: AppCurrent.object.selected },
    { keyName: 'Shift+ARROWRIGHT', command: 'object.shift.right', when: AppCurrent.object.selected },
    { keyName: 'Shift+ARROWUP', command: 'object.shift.up', when: AppCurrent.object.selected },
    { keyName: 'Shift+ARROWDOWN', command: 'object.shift.down', when: AppCurrent.object.selected },

    /* ---------------------------------- #page --------------------------------- */
    { keyName: 'PAGEUP', command: 'note.page.prev', when: '' },
    { keyName: 'PAGEDOWN', command: 'note.page.next', when: '' },
    { keyName: 'ARROWUP', command: 'note.page.prev', when: '' },
    { keyName: 'ARROWDOWN', command: 'note.page.next', when: '' },
    { keyName: 'Ctrl+M', command: 'note.page.new', when: AppCurrent.page.selected },
    { keyName: 'Ctrl+D', command: 'note.page.duplicate', when: AppCurrent.page.selected },
    { keyName: 'Ctrl+X', command: 'note.page.cut', when: AppCurrent.page.selected },
    { keyName: 'Ctrl+C', command: 'note.page.copy', when: AppCurrent.page.selected },
    { keyName: 'Delete', command: 'note.page.delete', when: AppCurrent.page.selected },
    { keyName: 'Ctrl+S', command: 'note.page.saveas', when: AppCurrent.page.selected },

    /* --------------------------------- #editor -------------------------------- */
    { keyName: 'Ctrl+Z', command: 'editor.undo', when: AppCurrent.object.notEditing },
    { keyName: 'Ctrl+Y', command: 'editor.redo', when: AppCurrent.object.notEditing },
    { keyName: 'Ctrl+V', command: 'editor.paste', when: AppCurrent.object.notEditing },    // 포커스를 가진 쪽에 보내야 하는데 아직 focus기능이 없으니 global


]

// menuId command map
// meneId -> command 변환 
// 다 정의하는 것이 아니라 불가피하게 menuId하고 command가 다른경우 
export const AppMenuIdCommandMap: any = {
    //'note.open': AppCommand.note.open,
}

export interface IAppEventParams {
    key: string;
}

// export const BLConfig = {
//     userId: '',
//     guide: {
//         isShowBannerItem: true
//     }
// }

export enum MenuIds {
    noteMenuInNoteList = 'noteMenuInNoteList',
    noteMenuInCurrPage = 'noteMenuInCurrPage',
    noteMenuInCurrNote = 'noteMenuInCurrNote',

    pageItemMenu = 'pageItemMenu',

    mediaItem = 'mediaItem',

    object = 'object',
    objectContext = 'objectContext',

    // 내가 만든 아이템 패널
    myCreatedItemPanel = 'myCreatedItemPanel',

    // toolbar
    penPalette = 'penPalette',
    penDepth = 'penDepth',
    lineHeight = 'lineHeight',
    penPropertyMobile = 'penPropertyMobile',
    objectMobile = 'objectMobile',

    // template menus
    templateMenuInGrid = 'templateMenuInGrid',
    templateMenuInTemplatePanel = 'templateMenuInTemplatePanel',
    templateMenuInDeletePanel = 'templateMenuInDeletePanel',
    templatePackMenuInGrid = 'templatePackMenuInGrid',
    templatePackMenuInItemPackPanel = 'templatePackMenuInItemPackPanel',

    // sticker menus
    stickerPackMenuInGrid = 'stickerPackMenuInGrid',
    downStickerPackMenuInGrid = 'downStickerPackMenuInGrid',
    stickerMenuInGrid = 'stickerMenuInGrid',
    // stickerPackMenuInPanel = 'stickerPackMenuInPanel',
    stickerPackMenuInItemPackPanel = 'stickerPackMenuInItemPackPanel',

    //mystore
    myStoreProductMenu = 'myStoreProductMenu',

    //login
    inquiry = 'inquiry',

    noteInfo = 'noteInfo',
    templateInfo = 'templateInfo',
    pageInfo = 'pageInfo',
    makePDF = 'makePDF'
}

export enum SidebarIds {
//    primary = 'primary',
//    editor = 'editor',
    note = 'note'
}

export const AppDefaultConfig = {
    userId: '',
    guide: {
        isShowBannerItem: true,
        isShowGuide: {
            'new-page': true,
            'new-note-note': true,
            'template-create': true,
            'sticker-create': true,
            'template-use': true,
            'sticker-use': true,
            'add-templates': true,
            'store-page': true,
            'store-sticker': true,
        }
    },
    alwayDesktoViewpInDesktop: false,
    alwayDesktopViewInInTablet: false
}

export const AppDefaultState = {
    userId: '',
    selectedPenIndex: {
        pen: {
            color: 0,
            depth: 0
        },
        marker: {
            color: 0,
            depth: 0
        },
        eraser: {
            depth: 0
        }
    },
    penPalette: {
        pen: {
            color: ['#0000ff', '#000000', '#ff0000'],
            depth: [0.5, 4, 8]
        },
        marker: {
            color: ['#f8e700', '#5dff46', '#a1f9ff'],
            depth: [2, 4, 5]
        },
        eraser: {
            depth: [2, 5, 9]
        }
    },
    customPalette: {
        pen: ['#0000ff', '#000000', '#ff0000'],
        marker: ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffa238'],
        text: ['#0000ff', '#000000', '#ff0000']
    },    
    isShowPageGridSidebar: true,
    lastOpenedNoteKey: ''
}

export const AppPalette = [
    ['#FFFFFF', '#F2F2F2', '#D9D9D9', '#999999', '#595959', '#262626'],
    ['#C8F8FF', '#85EBFF', '#33DDFF', '#00AFD1', '#0087A2', '#075767'],
    ['#CCE5FF', '#99D8FF', '#1FA9FF', '#0079C6', '#0065A3', '#06446C'],
    ['#D9DFFA', '#B6C2F5', '#667CE0', '#2044E0', '#152FA3', '#0B1D6F'],
    ['#E1B8F6', '#D396ED', '#B651E1', '#8C20BA', '#5D147C', '#410F57'],
    ['#FFD5F1', '#FCC5E2', '#BC77BC', '#EA1889', '#9C0757', '#610536'],
    ['#FFE3D3', '#FFCAC2', '#FF8370', '#F22B0C', '#A31600', '#520B00'],
    ['#FFEBC1', '#FFD5AD', '#FFAB5C', '#FF7D00', '#AF5500', '#522700'],
    ['#FFF6C1', '#FFE2AD', '#FFC65C', '#FFA500', '#A56E06', '#613F00'],
    ['#FFFFC1', '#FFF0AD', '#FFE570', '#FFCF00', '#B89600', '#665300'],
    ['#F3FFC1', '#E1FEAD', '#FFFD70', '#F4EF21', '#B8B500', '#7A7800'],
    ['#E8FFB3', '#D7F7A1', '#AFFF26', '#88ED24', '#67B31B', '#416F14'],
    ['#C5FDD3', '#A2F2BD', '#82F5A8', '#25D55F', '#179942', '#0D6129'],
    ['#FFFFFF', '#F2F2F2', '#D9D9D9', '#999999', '#595959', '#262626'],
];

export const AppFonts = [
    { name: 'Helvetica', fontFamily: 'Helvetica' },
    { name: 'Verdana', fontFamily: 'verdana' },
    { name: 'Courier', fontFamily: 'courier' },
    { name: 'Intel one Mono', fontFamily: 'intelone-mono-font-family-regular' },
    { name: '고딩체', fontFamily: 'Gothic_Goding' },
    { name: '느릿느릿체', fontFamily: 'SlowSlow' },
    // { name: '하나손글씨체', fontFamily: 'Hana_handwriting'},
    { name: '나눔손글씨 중학생', fontFamily: 'Middleschool_student' },
    { name: '암스테르담체', fontFamily: 'Amsterdam' },
    { name: '오뮤 다예쁨체', fontFamily: 'omyu_pretty' },
    { name: '온글잎 올망똘망체', fontFamily: 'olmang' },
    { name: '온글잎 위리체', fontFamily: 'OwnglyphWiri'},
    { name: 'IBM Plex Sans', fontFamily: 'IBMPlexSansKR' },
    { name: 'G마켓산스체', fontFamily: 'GmarketSans' },
    { name: '강원교육모두체', fontFamily: 'GangwonEdu' },
    { name: '경기천년바탕체', fontFamily: 'GyeonggiBatang' },
    { name: '서울남산체', fontFamily: 'SeoulNamsanM' },
    { name: '서울한강체', fontFamily: 'SeoulHangangM' },
    { name: '조선궁서체', fontFamily: 'ChosunGs' },
    { name: '조선굴림체', fontFamily: 'ChosunGu' },
    { name: '조선100년체', fontFamily: 'ChosunCentennial' },
    { name: '조선신명조체', fontFamily: 'ChosunSm' },
    { name: '조선일보명조체', fontFamily: 'Chosunilbo_myungjo' },
    { name: '조선가는고딕체', fontFamily: 'ChosunSg' },
    { name: '조선견고딕체', fontFamily: 'ChosunBg' },
    { name: '로커스상상고딕체', fontFamily: 'LocuSangSang' },
    { name: '페이북체', fontFamily: 'paybooc' },
    { name: 'KCC 간판체', fontFamily: 'KCC-Ganpan' },
    { name: 'HS새마을체', fontFamily: 'HSSaemaul' },
    { name: '둘기마요고딕', fontFamily: 'Dovemayo_gothic' },
    { name: '원스토어 모바일고딕 본문체', fontFamily: 'ONE-Mobile-Regular' },
    { name: '빙그레체', fontFamily: 'Binggrae' },
    { name: '빙그레Ⅱ체', fontFamily: 'BinggraeⅡ' },
    { name: '배달의 민족 한나체Pro', fontFamily: 'BMHANNAPro' },
    { name: '이사만루체', fontFamily: 'GongGothicMedium' },
    // { name: '앵무부리체', fontFamily: '116angmuburi'},
    // { name: '앵덕정직체', fontFamily: '116angduk_honesty15'},
    { name: '카페24 써라운드체', fontFamily: 'Cafe24Ssurround' },
    { name: '코트라 볼드체', fontFamily: 'KOTRA_BOLD' },
    { name: '땅스부대찌개 볼드체', fontFamily: 'TTTtangsbudaejjigaeB' },
    { name: '원스토어 모바일POP체', fontFamily: 'ONE-Mobile-POP' },
    { name: '원스토어 모바일고딕 제목체', fontFamily: 'ONE-Mobile-Title' },
    { name: '필승고딕체', fontFamily: 'PilseungGothic' },
    { name: '샌드박스어그로체', fontFamily: 'SBAggroB' },
    { name: '안성탕면체', fontFamily: 'Ansungtangmyun' },
    { name: '세방고딕체', fontFamily: 'SEBANG_Gothic' },
    { name: '좋은이웃체', fontFamily: 'GoodNeighbors-Good-Neighbors-Bold' },
];

export const AppTemplateSizeList = [
    {
        name: '작은 노트 - 휴대폰용',
        value: '360*509'
    },
    {
        name: '작은 메모 - 휴대폰용',
        value: '360*360'
    },
    {
        name: '중간 노트 - 휴대폰용',
        value: '420*595'
    },
    {
        name: '중간 메모 - 휴대폰용',
        value: '420*420'
    },
    // {
    //     name: '사용자 지정',
    //     value: ''
    // },
    // {
    //     name: '인스타그램 정사각 최대 ',
    //     value: '1080*1080'
    // },
];

// export const AppItemCountLimit: any = {
//     NPNote: {
//         name: '일기장',
//         per: '개인',
//         count: 2
//     },
//     NPPageTemplate: {
//         name: '속지',
//         per: '개인',
//         count: 0
//     },
//     NPSticker: {
//         name: '스티커',
//         per: '팩당',
//         count: 0,
//     },
//     NPPageTemplatePack: {
//         name: '속지팩',
//         per: '개인',
//         count: 0,
//     },
//     NPStickerPack: {
//         name: '스티커팩',
//         per: '개인',
//         count: 0,
//     },
// };

/* -------------------------------------------------------------------------- */
/*                                  app  #user 사용자                         */
/* -------------------------------------------------------------------------- */

export const AppSpecialUser = {
    admin: [
        'crefestudio@gmail.com',
        'toto.blank365@gmail.com',
        'loolloo.blank365@gmail.com'
    ],
    developer: [
        'toto791.dev@gmail.com',
        'toto.blank365@gmail.com', // review, 프리미엄으로 전환하려고 넣음
        'kjisun1221@gmail.com',
    ],
}

export const AppSpecialUserAccount = {
    guest: [
        { email: 'totosite@naver.com', password: 'blank1129' }
    ],
    tester: [
        { email: 'toto.blank365@gmail.com', password: '12341234' }
    ]
}