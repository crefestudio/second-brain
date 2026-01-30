import { getFunctions, httpsCallable } from 'firebase/functions';
import { SafeHtml } from '@angular/platform-browser';
import { _log, _valid, CFDate, readFile, readFileType, CFHelper, _slog, _flog, CFDateFormat, BLGPS } from '../cf-common/cf-common'
//import { CFFBAPI } from './cf-fbapi'; 
import { environment } from 'src/environments/environment';
import { CFFBStoreAPI, FBOrderDirection } from './cf-fb-store-api';
import { fabricObjectType } from '../fabricjs/fabricjs-type';
import { FBFunctionsRegion } from 'src/_note-platform/services/fb-functions.service';

export interface NPDateType { year: number, month: number, day: number };
export interface NPYearMonthType { year: number, month: number, day: number };

export interface NPVisonImageAnnotationData {
    text: string;
    labels: string[];
}

export enum CalSkinIds {
    SkinBasicIvory = 'SkinBasicIvory',
    SkinDrawingCalendar = 'SkinDrawingCalendar',
    SkinCalIvory = 'SkinCalIvory',
    SkinCalPink = 'SkinCalPink',
    SkinCalLavender = 'SkinCalLavender',
    SkinCalPeach = 'SkinCalPeach',
    SkinESDiaryIvory = 'SkinESDiaryIvory'
}

// notice store와 중복 
export enum NoticeType {
    update = 'update',          // 업데이트 알림

    gift = 'gift',              // 회원 혜택
    event = 'event',            // 이벤트
    operation = 'operation',    // 운영공지
    product = 'product',        // 새상품

    diary = 'diary',            // 일기 쓰기 알림   
}

enum UpdateObjectActionType {
    add = 'add',
    delete = 'delete',
    update = 'update',
    updateObjects = 'updateObjects', // 지우개 / 여러개 갱신
    reorder = 'reorder',
}

interface IUpdateObjectParams {
    object: any | Array<any>;
    action: UpdateObjectActionType;
    pageKey: string;
}

export enum NPError {
    unknown = 'unknown',
    notAllowFileType = 'notAllowFileType',
    notSupportVideoType = 'notSupportVideoType',
    stickerFileReadFail = 'stickerFileReadFail',
    notCreateNotePrivateTemplate = 'notCreateNotePrivateTemplate', // cannot create a note or page using a private template.
    sameItem = 'sameItem',
    dataSizeExceeded = 'dataSizeExceeded'
}

export enum NPAuth {
    public = 'public',
    member = 'member',
    private = 'private',
}

export class NPLList {
    public list = []
}

export enum NPOrderType {
    asc = 'asc',
    desc = 'desc'
}

export enum NPResourceType {
    svg = 'svg'
}

export enum NPPageItemType {
    text = 'text',
    check = 'check'
}

export interface NPSize {
    width: number;
    height: number;
}

export interface NPOffset {
    x: number;
    y: number;
}

export interface INPProduct {
    name: string,
    type: string,
    isOpen: boolean,
    tags: Array<string>,
    tagPrice: number,
    price: number,
}

export interface INPSearchResultPage {
    objectID: string,
    noteKey: string,
    previewSvg: string,
    noteName: string,
    content: string | SafeHtml,
    pageKey: string,
    note: NPNote,
    updateDate: string,
    itemWidth?: number,
    itemHeight?: number,
    previewCacheSvg: string
}

// export interface INPNoteSearchResultParams {
//     notes: Array<NPNote>,
//     pages: Array<INPSearchResultPage>,
// }

export class NPEntity {
    constructor(
        public _key: string = CFHelper.id.generateUUID()
    ) {
    }
}

// export function copyObject(targetObj: any, srcObj: any, expertKey?: string) {
//     for(let key of Object.keys(targetObj)) {
//         if(srcObj[key] !== undefined && key !== expertKey) {
//             targetObj[key] = srcObj[key];
//         }
//     }
// }

export enum NPImageType {
    undefined = '',
    svg = 'svg',
    image = 'image' // svg를 제외한 이미지
}

export interface INPImage {
    type: string;
    data: string;
    uri: string;
    userId: string;
    auth: string;
}

// item이란 
// grid에서 하나의 셀로 나올 수 있는 것 / 메뉴가 나올 수 있는 것    
// 상품이 될 수 있는 것
// 창작자와 소유자가 있는 것
// 이름이 있는 것
// 휴지통에 들어갈 수 있는 것 / 나중에
// 하위 요소를 가질 수 있음

// pageTemplate, stickerPack, noteTemplate

export enum NPItemType {
    note = 'NPNote',                            // extends                              
    folder = 'NPFolder',                        // item과 동일      folder, note
    pageTemplate = 'NPPageTemplate',            // extends
    pageTemplatePack = 'NPPageTemplatePack',    // item과 동일      pageTemplate
    sticker = 'NPSticker',                      // extends      
    stickerPack = 'NPStickerPack',              // item과 동일      sticker
}

export enum NPItemListType {
    myCreated = 'myCreated',         // 내가 만든
    myDownloaded = 'myDownloaded',  // 내가 다운로드 받은 
    my = 'my',                      // 내가 가진
    //public = 'public'               // 공공의, 밠행된 product에 포함된 item    
}

export class NPItem extends NPEntity {
    public id: string = CFHelper.id.generateUUID(); // instance가 생길 때 자동으로 보여 됨 / 복사 시에도 그대로 유지하여 해당 아이템임을 식별한다. _key와 다름 
    public productKey: string = '';             // 이 아이템을 publish 할 때, 이걸로 발행 여부를 판단함, download한 아이템의 경우 productKey가 있을 텐데, 이걸 발행하면 productKey가 바뀜
    public isUserSetCoverImage: boolean = false;
    public downloaderId: string = '';
    public registDate: string = CFDate.nowAsString();
    public updateDate: string = CFDate.nowAsString();
    // 템플릿 업데이트 하면서 넣음, 템플릿을 수정해서 새로 상품을 만들고 다시 받음, 노트에서 템플릿을 사용할때 기존 템플릿에서 이미 사용했는지 확인해서 재사용하는데 id가 같은 경우에 
    // 계속 이전에 사용한 아이템이 나오게 됨
    // 재사용 캐시에서 현재 새로운 아이템과 매치
    public version?: number = 1; 
    public skinId: string = ''

    constructor(
        public type: NPItemType,
        public name: string,
        public userId: string,                  // 소유자
        public creatorId: string,               // 생성자
        public coverImageURI: string = '',      // 생성 시에는 없을 수 있음, canvas에서 preview이미지를 따옴
        public width: number = 0,
        public height: number = 0,
        public parentItemKey: string = '',  // 나의 parent item, 여기서 item은 패키지 또는 폴더 임
        public tags: Array<string> = [],
    ) {
        super();
        //NPItem.makeFilter(this); // 이때는 product_key가 없는데
    }

    // filter 
    // public productKey_userId: string = '';
    // public creatorId_userId: string = '';
    // public static makeFilter(item: NPItem) {
    //     item.productKey_userId = `${item.productKey}_${item.userId}`;   // user가 해당 아이템을 소유 했는지 판단
    //     item.creatorId_userId = `${item.creatorId}_${item.userId}`;
    // }
}

/* -------------------------------------------------------------------------- */
/*                                    #data                                   */
/* -------------------------------------------------------------------------- */

export enum NPDataType {
    none = 'none',              // 빈 값으로 두게 되면 한글 '없음'으로 나오는게 아닌 빈값으로 나옴.
    title = 'title',            // 페이지 내 권장 개수  : 1 , textInputBox          => 리스트에서 제목을 표시 할 때 여러개면 혼란이 됨
    content = 'content',        // 1                                               => 내용을 표시하는 데 여러개면 혼란이 됨  
    date = 'date',              // 1
    drawing = 'drawing',        // 1 or n
    photo = 'photo',            // 1 or n
    //////////////////////////////////////////////////
    // mood = 'mood',              // 1 or n                // 
    // weather = 'weather',        // 1 or n
}

export const NPDataTypeKor: any = {
    none: '없음',
    title: '제목',        // 페이지 내 권장 개수  : 1 , textInputBox          => 리스트에서 제목을 표시 할 때 여러개면 혼란이 됨
    content: '내용',      // 1                                               => 내용을 표시하는 데 여러개면 혼란이 됨  
    date: '일시',         // 1
    drawing: '그림',      // 1 or n
    photo: '사진',        // 1 or n
}

// 통계의 대상은    -> tag로, 날씨, 감정    => object에 tag를 넣어야 함 -> image에 어떻게 tag를 넣냐?
// 데이타 타입은    -> 앱에서 표시하기 위해서 

export let usefulDataTypesOfTemplateObjectType: any = {
    textInputBox: [NPDataType.none, NPDataType.title, NPDataType.content],
    imageInputBox: [NPDataType.none, NPDataType.photo],
    drawingInputBox: [NPDataType.none, NPDataType.drawing],
    currDateTimeText: [NPDataType.none, NPDataType.date],
    // stickerInputBox:  type이 한정되지 못함      =>  안에 image의 tags           image: dataType : 'mood' or 'weather' , data: 'joy' or 'sunny'
    // stickerGroupInputBox: type이 한정되지 못함      =>  안애 images의 tags      image: dataType : 'mood' or 'weather' , data: 'joy' or 'rainy'
    // currCalText
}

// textInputBox = 'textInputBox',      //  title, content => title은 아직, content로 고정
// imageInputBox = 'imageInputBox',    //  photo 
// checkbox = 'checkbox',              //  checkItem { text: done: }
// stickerInputBox = 'stickerInputBox',
// stickerGroupInputBox = 'stickerGroupInputBox',

// // 표시
// currDateTimeText = 'currDateTimeText',   // object 가 생성된 시점에서 현재 날짜 / 시간 
// currCalText = 'currCalText'

// export enum NPDataMoodType {
//     joy = 'joy',            // 신남
//     happy = 'happy',        // 기쁨
//     content = 'content',    // 만족스러움
//     nautral = 'nautral',    // 보통의
//     tired = 'tired',        // 피곤함
//     sad = 'sad',            // 슬픔
//     angry = 'angry'         // 화남
//     depressed = 'depressed' // 우울
// }

export interface NPPageData {
    pageKey: string;
    numberOfImages: number; // 페이지에 포함된 전체 사진 수

    previewSvgData?: string;
    title?: string;
    content?: string;
    date?: string; // iso date string
    photoUrl?: string;           // 대표사진
    drawingUrl?: string;
    stickerUrls?: Array<string>;
    thumbImageUrl?: string;   // 사진과 그림을 동시에 표시할 일이 있을까?
    thumbImageUrlDark?: string; 
    thumbViewBox?: {left: number, top: number, width: number, height: number }; 
    isHoriOfthumbImage?: boolean;

    // ai 
    aiData?: NPVisonImageAnnotationData;    // 그림 : text, 사진 : text, labels

    isPrimaryOfDay?: boolean;
}

export enum NPMediaType {
    photo = 'photo',
    drawing = 'drawing'
}

export interface NPMediaData {
    type: NPMediaType;
    src: string;
    thumbImageUrl: string;
    thumbImageUrlDark: string;
    date: string;
    noteContentKey: string;
    pageKey: string;
    width: number;
    height: number;
    byte?: number;
};

export enum NPPageDataContentType {
    onlyImage = 'onlyImage',
    onlyText = 'onlyText',
    textAndImage = 'textAndImage'
};

// export enum NPDataWeatherType {
//     sunny = 'sunny',                // 맑음
//     partlyCloudy = 'partlyCloudy',  // 구름 조금
//     cloudy = 'cloudy',              // 흐림
//     rainy = 'rainy',                // 비 오는
//     snowy = 'snowy'                 //눈 오는
// }


/* -------------------------------------------------------------------------- */
/*                                    #Note                                   */
/* -------------------------------------------------------------------------- */

export enum NoteViewMode {
    edit = 'edit',  // false
    grid = 'grid',  // true
    monthCalendar = 'monthCalendar'
}

export enum NoteListType {
    list = 'list',
    calendar = 'calendar',
    map = 'map',
    media = 'media'
}

export enum NoteHolidayDisplayType {
    none = 'none',
    onlyDay = 'onlyDay',
    show = 'show'
}

export enum NoteCanvasScaleFitType {
    fitWindow = 'fitWindow',
    oriSize = 'oriSize',
    _120 = '120%'
}

export class NPNote extends NPItem {
    // public registDate: string = CFDate.nowAsString();
    // public updateDate: string = CFDate.nowAsString();
    public contentKey: string = '';

    // filtering property
    public isDeleted: boolean = false;
    public isBookmark: boolean = false;
    public isRemind: boolean = true;        // 노트 쓰기 알림을 할 것인지??
    public fcmTokens: Array<string> = [];   // 해당 앱에서 알림받기를 승인 후 얻은 token들
    public isPublic: boolean = false;
    public isPublished: boolean = false;    // 발행여부
    public isNotice: Record<NoticeType, boolean> = {
        update: true,           // 업데이트 알림
        diary: true,            // 일기 쓰기 알림
        gift: true,             // 회원 혜택
        event: true,            // 이벤트
        operation: true,        // 운영공지
        product: true           // 새상품
    };

    public canvasScaleFitType: NoteCanvasScaleFitType = NoteCanvasScaleFitType.fitWindow;
    public isShowPhotoInCalendar: boolean = true;

    // config
    // public isAddForward: boolean = true;   // 새 페이지 추가 시 앞으로 추가하기

    // fitler
    // public userId_isDeleted: string = '';
    // public userId_isDeleted_isBookmark: string = '';

    // cover image를 user가 세팅했는지 여부
    // public isUserSetCoverImage: boolean = false;
    public password: string = '';   // 패스워드 새롭게 추가 
    constructor(
        name: string,
        userId: string,
        coverImageURI: string,
        width: number,
        height: number,
        //noteContent: NPNoteContent,
        public defaultViewMode: NoteViewMode = NoteViewMode.edit,      // 기본 보기 모드
        public isAddForward: boolean = true,
        public isOpenFromLastPage: boolean = true,
        public isLock: boolean = false,
        productKey: string = '',
        tags: Array<string>,
        public listType: NoteListType = NoteListType.list, // 이거 defaultListType으로 해야 하는데
        public holidayDisplayType: NoteHolidayDisplayType = NoteHolidayDisplayType.none,
        skinId: CalSkinIds = CalSkinIds.SkinDrawingCalendar
    ) {
        super(NPItemType.note, name, userId, userId, coverImageURI, width, height, skinId);
        this.productKey = productKey;
        this.tags = tags;
        this.skinId = skinId;
    }

    // public static makeNoteFilter(note:NPNote) {
    //     note.userId_isDeleted = `${note.userId}_${note.isDeleted? 1: 0}`;
    //     note.userId_isDeleted_isBookmark =`${note.userId}_${note.isDeleted? 1: 0}_${note.isBookmark? 1: 0}`;
    // }
}

export class NPNoteContent extends NPEntity {
    public pages: Array<NPPage> = [];
    public templates: Array<NPPageTemplate> = [];
    public noteKey: string = '';
    constructor(
        public note: NPNote,
        public userId: string
    ) {
        super();
        this.noteKey = note._key;
    }
}

export class NPPage extends NPEntity {
    public seq?: string;    // db에 저장 할 때 생성됨, pages에서 page의 순서를 나타냄
    public registDate: string = CFDate.nowAsString();
    public updateDate: string = CFDate.nowAsString();
    public heartCount?: number = 0;
    public date?: string;   // 페이지에 날짜를 직접 추가 함, 속도 개선을 위한 필터링 때문에
    public gps?: BLGPS
    public isPrimaryOfDay: boolean = false;
    constructor(
        public templateKey: string,     
        public templateId: string,      // 추가 : 공개일기할때 추가 한것 같음, 노트에서 템플릿 가져올때 templateKey사용함, templateKey가 없을때 templateId를 사용해서 복구하도록 함 25/03/14
        public objects: Array<any> = [],
        public userId: string,
        public backgroundColor: string,
        public previewCacheSvg: string, 
        public isPublic: boolean,       // 추가 : 공개일기할때 추가 한것 같음 
        public noteContentKey: string,  // 추가 : 공개일기할때 추가 한것 같음 
    ) {

        super();
    }
}

// relation 
export class NPPageHeart extends NPEntity {
    constructor(
        public noteContentKey: string,
        public pageKey: string,
        public userId: string
    ) {
        super();
    }
}

// export enum NPSyncType {
//     folder = 'folder',
//     noteContent = 'noteContent',
//     page = 'page',
// }

// export class NPNoteSync extends NPEntity {
//     constructor(
//         public type: NPSyncType,
//         public userId: string,
//         public targetKey: string,
//         public updateDate: string = CFDate.nowAsString()
//     ) {
//         super();
//     }
// }



// export class NPNoteList extends NPEntity {
//     public noteKey: string;
//     public coverImageURI: string;
//     public name: string;
//     public userId: string;
//     public updateDate: string;

//     constructor(note: NPNote) {
//         super();
//         this.noteKey = note._key;
//         this.coverImageURI = note.coverImageURI;
//         this.name = note.name;
//         this.userId = note.userId;
//         this.updateDate = note.updateDate;
//     }
// }

// template을 참조로 가지고 있으면 템플릿이 바뀌떄 문제가 되서 안됨 
// 해당 노트안에서 참조로 가지고 있도록 해야 함 

// export class NPPageData extends NPEntity {
//     constructor(
//         //public templateItemKey: string, 
//         public content: string = '',
//         public isPushNotification: boolean = false,
//         public checked: boolean = false,
//         public startDate?: Date,
//         public endDate?: Date,
//         ) {
//         super();
//     }
//     public registDate: string = CFDate.nowAsString();
//     public updateDate: string = CFDate.nowAsString();
// }

////////////////////////////
//  Template

// {"_key":"qhfT-qYo6t2eBqqM0kv6s","registDate":"2023-02-01T09:58:47.023Z","templateSeq":0,"id":"ID_TEMPLATE_TEST","name":"템플릿 편집 테스트",
// "userId":"107847450339994246478","creatorId":"107847450339994246478","width":360,"height":509}

/*
    // background: background
    // backgroundImageUrl: backgroundImage.src
    // objects
    /*    
    {
        "type": "textInputBox",
        "left": 100,
        "top": 100,
        "width": 200,
        "height": 200,
        "scaleX": 1,
        "scaleY": 1,
        "angle": 0,
        "fontFamily": "Helvetica",
        "fontWeight": "normal",
        "fontSize": 20,
        "text": "test",
        "underline": false,
        "overline": false,
        "linethrough": false,
        "textAlign": "left",
        "fontStyle": "normal",
        "lineHeight": 1.16,
        "textBackgroundColor": "",
        "charSpacing": 0,
        "backgroundColor": ""
    }
*/

export class NPPageTemplatePack extends NPItem {
    constructor(
        name: string,
        userId: string,
        creatorId: string,
        coverImageURI?: string
    ) {
        super(NPItemType.pageTemplatePack, name, userId, creatorId, coverImageURI)
    }
}

export class NPPageTemplate extends NPItem {
    public backgroundColor: string = '#ffffff';
    //public backgroundColorPattenName?: string  = ''; // '', 'dot', 'grid'
    public backgroundImageURI: string = '';
    public backgroundImageName: string = '';
    public previewSvgURI: string = '';
    public objects: Array<any> = [];
    public isPopupColorPicker: boolean = false;
    public seq: number = 100; // seq를 지정하지 않으면 맨 뒤로 감

    constructor(
        name: string,
        userId: string,  // userId // 소유자
        width: number,
        height: number,
        parentItemKey: string,
        backgroundImageURI?: string,
        objects?: Array<any>
    ) {
        super(NPItemType.pageTemplate, name, userId, userId, '', width, height, parentItemKey);

        if (backgroundImageURI) {
            this.backgroundImageURI = backgroundImageURI;
        }

        if (objects && objects.length > 0) {
            this.objects = objects;
        }
    }

    // static converter = {
    //     toFirestore: (pageTemplate: any) => {   // 이미 deepClone값일것임
    //         _log('NPPageTemplate::converter pageTemplate=>', pageTemplate);
    //         // let data = CFHelper.json.deepClone(pageTemplate);
    //         // if (data.objects) {
    //         //     // 콜렉션에 저장하고 
    //         //     delete data.objects;
    //         // }
    //         return pageTemplate;
    //     },
    //     fromFirestore: (snapshot: any, options: any) => {
    //         _log('NPPageTemplate::converter snapshot, options =>', snapshot, options);
    //         const data = snapshot.data(options);
    //         // let objects = await this.api.getCollection(`NPPageTemplate/${template._key}/objects`); // !!
    //         // template.objects = objects;
    //         //objects를 붙여서 
    //         return data;
    //     }
    // }

    // const ref = doc(db, "cities", "LA").withConverter(cityConverter);
    // await setDoc(ref, new City("Los Angeles", "CA", "USA"));

    // public static makeFilter(template: NPPageTemplate) {
    //     template.userId_creatorId = `${product.approve}_${product.isOpen}_${product.type}`;
    // }
}

// NPWidgetTemplate, NPWidgetTemplatePack

export class NPStickerPack extends NPItem {
    constructor(
        name: string,
        userId: string,
        creatorId: string,
        coverImageURI?: string
    ) {
        super(NPItemType.stickerPack, name, userId, creatorId, coverImageURI)
    }
}

export class NPSticker extends NPItem {
    constructor(
        stickerPackKey: string,
        userId: string,
        creatorId: string,
        //tags: string,
        public imageURI: string,       // 스티커의 경우 커버이미지가 곧 컨텐츠 이미지이다.
        width: number = 0,
        height: number = 0
    ) {
        super(NPItemType.sticker, '태그없음', userId, creatorId, imageURI, width, height);
        this.parentItemKey = stickerPackKey;
    }
}

// Entity Template
// export class NPPageTemplateItem extends NPEntity {
//     name!: string; // 관리상 이름
//     offset!: NPOffset;
//     size!: NPSize;
//     type!: NPPageItemType;
// }

// export class NPPageItem extends NPPageTemplateItem {
//     data!: NPPageData;
// }

// export class NPItem extends NPEntity {

// }

// export class NPTextInputBox {
//     type: string = "textInputBox";
//     left: number = 0;
//     top: number = 0;
//     width: number = 360;
//     height: number = 509;
//     scaleX: number = 1;
//     scaleY: number = 1;
//     angle: number = 0;
//     fontFamily: string ="helvetica";
//     fontWeight: string = "normal";
//     fontSize: number = 20;
//     text: string = "";
//     underline: boolean = false;
//     overline: boolean = false;
//     linethrough: boolean = false;
//     textAlign: string = "left";
//     fontStyle: string = "normal";
//     lineHeight: number = 1.16;
//     textBackgroundColor: string = "";
//     charSpacing: number = 0;
//     backgroundColor: string = "";
// }

export class NPResource extends NPEntity {
    public uri: string;
    constructor(
        public type: NPResourceType,
        public data: any,
        public userId: string,
        public auth?: NPAuth
    ) {
        super(); // 여기서 키가 만들어짐 !! api.create하면 _key를 바꿈 여기서 key 사용하면 안됨, 순서 기반이니 직접 만들어도 안됨
        if (!auth) {
            this.auth = NPAuth.private;
        }
        this.uri = `np${type}://${this._key}:${this.userId}:${this.auth}`;
    }
}

/* -------------------------------------------------------------------------- */
/*                              #publish #product                             */
/* -------------------------------------------------------------------------- */
export enum NPProductApproveType {
    before = 'before',  // 신청 전
    request = 'request',    // 대기
    approve = 'approve', // 승인
    reject = 'reject',  // 거절
    stop = 'stop',      // 임시중지
    oldVersionForSale = 'oldVersionForSale',   // 수정 신청 시 기존 상품 새버전 출시로 아직은 판매중 
    oldVersionNotSale = 'oldVersionNotSale'   // 새버전 승인 시 관리지가 내림   
}

export class NPProduct extends NPEntity {
    public registDate: string = CFDate.nowAsString(); // db생성 시 다시 넣어주고 있음
    public approve: NPProductApproveType = NPProductApproveType.before;
    public approveMessage: string = '';
    public saleCount: number = 0;
    public displayCount: number = 0;
    public publicItemKey: string = '';    // 발행 시 복사한 아이템 
    public orderPriority: number = 0;

    constructor(
        public name: string,
        public description: string,
        public isOpen: boolean,         // ????
        public tags: Array<string>,
        public tagPrice: number,        // 정가
        public price: number,           // 판매가
        public oriItemKey: string,      // 발행한 원래 아이템
        public type: NPItemType,
        public creatorId: string,
        public itemWidht: number,       // 왜 있는지 모르겠음 / 없어야 할듯한데 / thumbnail표시에 사용함 
        public itemHeight: number,      // 왜 있는지 모르겠음 / 없어야 할듯한데 / thumbnail표시에 사용함 
        public thumbImageURI: string,
        public images: Array<string>,
        public isUserSetCoverImage: boolean,
        public userId: string
    ) {
        super(); // 여기서 키가 만들어짐 !! api.create하면 _key를 바꿈 여기서 key 사용하면 안됨, 순서 기반이니 직접 만들어도 안됨
    }

    // filter
}

// export enum NPProductType {
//     pageTemplate = 'NPPageTemplate',          // 속지
//     stickerPack = 'NPStickerPack',            // 스티커팩
//     package = 'package'                       // 묶음
// }

// export class NPPackageProduct extends NPProduct {
//     // publicItemKey
//     // oriItemKey
//     public productKeys: Array<string> = []; // itemType은 부적절함
// }

/*
new NPProduct(
    item.name,  // 패키지 상품의 이름을 넣으면 됨
    '', 
    true, 
    [], 0, 0, 
    item._key, 
    item.type, // 아잍템의 종류가 있음 : 
    this.appService.userId, 
    item.width, 
    item.height, 
    item.coverImageURI, 
    [], 
    false, 
    this.appService.userId);
*/

/* -------------------------------------------------------------------------- */
/*                                  #calendar                                 */
/* -------------------------------------------------------------------------- */

export class BLCalendarDayItemData {
    public title?: string;
    public content?: string;
    public date?: string; // iso date string
    public photoUrl?: string;           
    public drawingUrl?: string;
    public thumbImageUrl?: string;
    public thumbImageUrlDark?: string;
    public thumbViewBox?: { left: number, top: number, width: number, height: number };
    public numberOfItems?: number;
    public stickerUrls?: string[];
    public pageKey?: string;
    public pagePreviewSvg?: string;     
}

export interface BLCalDayInfo {
    year: number;
    month: number;
    day: number;
    itemData?: BLCalendarDayItemData;
}

/* -------------------------------------------------------------------------- */
/*                                  CFNoteAPI                                 */
/* -------------------------------------------------------------------------- */

// 두가지 파트로 나눠야 함 
// db에 저장 영역 / 메모리 영역

export class CFNoteAPI {
    static _self: CFNoteAPI;
    private api: CFFBStoreAPI;
    private app: any;
    //public loginedUserId: string = '';  // 검색에 필요할 때 사용함 

    constructor(db: any, app: any) {
        this.api = CFFBStoreAPI.getInstance(db);
        this.app = app;
        // this.test();
    }

    // async test() {
    //     // let template = await this.api.get('NPPageTemplate', 'cWVF4JJEYZfu8G6h0Ns4');  
    //     // const functions = getFunctions(this.app); 
    //     // const session = httpsCallable(functions, 'session');
    //     // let res = await session();
    //     // _log('test session res =>', res);
    // }

    // async getUserInfo(userId: string): Promise<any> {
    //     const functions = getFunctions(this.app); 
    //     const getUserInfo = httpsCallable(functions, 'getUserInfo');
    //     let result = await getUserInfo({
    //         userId: userId
    //     });
    //     _log('getUserInfo =>', result.data);
    //     return result.data as any;
    // }

    static getInstance(db?: any, app?: any) {
        if (!CFNoteAPI._self) {
            _valid(db);
            CFNoteAPI._self = new CFNoteAPI(db, app);
        }
        return CFNoteAPI._self;
    }

    static formatDate(isoDate: string) {
        // #jisun
        return isoDate;
    }

    /* -------------------------------------------------------------------------- */
    /*                                #item                                       */
    /* -------------------------------------------------------------------------- */

    async getNamesOfParentItem(parentItem?: NPItem, itemTypeOfRoot?: NPItemType, userId?: string, listType?: NPItemListType) {
        _flog(this.getNamesOfParentItem, arguments);
        _valid(parentItem || itemTypeOfRoot);

        let names: Array<string> = [];
        _log('getNamesOfChildren parentItem, itemTypeOfRoot =>', parentItem, itemTypeOfRoot);

        if (parentItem) {
            if (this._isItemCanHaveChildren(parentItem)) {
                let children = await this.listChildrenOfParentItem(parentItem);
                for (let item of children) {
                    names.push(item.name);
                }
            }
        } else if (itemTypeOfRoot && userId && listType) {
            let siblings;
            if (itemTypeOfRoot == NPItemType.note) {
                // 노트 가져오는것은 isDelete등 아직 item과 통합이 안되었다.
                siblings = await this.listMyNotes(userId, [], false);
            } else {
                siblings = await this.listItem(itemTypeOfRoot, userId, listType, undefined, FBOrderDirection.desc, false);
            }
            for (let item of siblings) {
                names.push(item.name);
            }
        }
        _log('getNamesOfParent names =>', names);
        return names;
    }

    // 내가 받은 아이템중에서 productKey가 일치하는 아이템 
    async getMyDownloadItemByProductKey(type: NPItemType, productKey: string, userId: string) {
        _flog(this.getMyDownloadItemByProductKey, arguments);
        let downloadedItems = await this.listItem(type, userId, NPItemListType.myDownloaded, undefined, FBOrderDirection.desc, false) as Array<NPPageTemplatePack>;
        if (!downloadedItems) { return []; }
        _log('getMyDownloadItemByProductKey downloadedItems =>', downloadedItems);
        return downloadedItems.filter((item) => (item.productKey == productKey));

    }


    // templatgePack, stickerPack생성에 사용
    async createItemWithNewNameInFolder(type: NPItemType, userId: string, name: string, coverImageURI?: string, itemWidth?: number, itemHeight?: number, listType?: NPItemListType, parentItem?: NPItem) {
        _flog(this.createItemWithNewNameInFolder, arguments);

        if (type !== NPItemType.folder && type !== NPItemType.pageTemplatePack && type !== NPItemType.stickerPack) { return; }

        let names: Array<string> = await this.getNamesOfParentItem(parentItem, type, userId, listType);
        let _title: string = await CFHelper.generate.newName(name, '제목없음', names);
        _log('createItemWithNewNameInFolder names, _title =>', names, _title);

        let item: NPItem = await this.createItem(type, userId, _title, coverImageURI, itemWidth, itemHeight);
        return item;
    }

    async createItem(type: NPItemType, userId: string, name: string, coverImageURI?: string, width?: number, height?: number,) {
        let item: NPItem = new NPItem(type, name, userId, userId, coverImageURI, width, height);
        return this.api.create(type, item);
    }

    async getItemByKey(type: NPItemType, key: string): Promise<NPItem> {
        if (type == NPItemType.pageTemplate) {
            let item = await this.getPageTemplate(key);
            if (!item) {
                throw new Error();
            }
            return item;
        }
        return this.api.get(type, key); // 
        // _valid(key != null);
        // return new Promise((resolve, reject) => {
        //     this.api.get(type, key).then((resp: any) => { 
        //         _log('CFNoteAPI::getItem resp =>', resp);
        //         if (!_valid(resp != null)) {
        //             throw Error();
        //         };
        //         resolve(resp);
        //     }).catch(() => { reject(); });
        // });
    }

    isItemICreate(item: NPItem, userId: string) {
        return (item.creatorId == userId);
    }

    // key가 없으면 새로 만들고, 있으면 변경함
    async setItem(item: NPItem, userId: string, isSaveObjects: boolean = true) {
        if (item.type == NPItemType.pageTemplate) {
            // objects까지 저장해줘야 한다.
            return this.setTemplate(item as NPPageTemplate, userId, isSaveObjects);
        }
        return this.api.set(item.type, item._key, item);
    }

    async deleteItem(item: NPItem) {
        return this.api.delete(item.type, item._key);
    }

    // child까지 포함한 완료 시점을 return;
    private _downloadItem(item: NPItem, toUserId: string): Promise<NPItem> {
        _flog(this._downloadItem, arguments);

        return new Promise((resolve, reject) => {
            // copy item
            this.copyItem(item, toUserId, toUserId, (item: NPItem) => {
                // child item 있을 경우 download 1depth child까지 포함한 완료 시점
                this.setItem(item, toUserId);
                resolve(item);
            })
        });

        // 하위아이템에 downloaderId 는 toUserId
        //_item.downloaderId = toUserId;
    }

    // async copyPageTemplate(template: NPPageTemplate) {
    //     // 기본 template 값 복사 
    //     let _template = new NPPageTemplate('', '', 0, 0);
    //     CFHelper.object.copyValue(_template, template, '_key');    // 키를 제외하고 복사!!!! 이렇게 해야 복사본과 key가 다르게 됨

    //     try {
    //         // copy bk image
    //         if (template.backgroundImageURI) {
    //             _template.backgroundImageURI = await this.copyImage(template.backgroundImageURI, template.creatorId);
    //         }

    //         // copy cover image
    //         if (template.coverImageURI) {
    //             _template.coverImageURI = await this.copyImage(template.coverImageURI, template.creatorId);
    //         }

    //         // copy previewSvgURI
    //         if (template.previewSvgURI) {
    //             _template.previewSvgURI = await this.copyImage(template.previewSvgURI, template.creatorId);
    //         }
    //     } catch(e: any) {
    //         _log('copyPageTemplate error =>', e);
    //         throw new Error(e);
    //     }

    //     // 날짜 변경
    //     _template.updateDate = CFDate.nowAsString();
    //     return _template;
    // }

    // 
    _createEmptyItem(type: NPItemType) {
        let item: NPItem;
        if (type == NPItemType.sticker) {
            item = new NPSticker('', '', '', '');
        }
        else if (type == NPItemType.pageTemplate) {
            item = new NPPageTemplate('', '', 0, 0, '');
        }
        else {
            item = new NPItem(type, '', '', '', '');
        }
        return item;
    }


    // pageTemplate일 경우 objects collection은 item.objects에 있고 값이 복사됨 
    // item값은 아직 db에 저장 된게 아님
    // toUserId와 loginedUserId 는 거의 같지만 다를 때가 있다. public 
    async copyItem(item: NPItem, toUserId: string, downloaderId?: string, onDownloadComplete?: any) {
        _valid(item);
        _log('copyItem item, toUserId =>', item, toUserId);
        let _item: any = this._createEmptyItem(item.type);
        try {
            // 기본 template 값 복사 
            CFHelper.object.copyValue(_item, item, '_key');    // 키를 제외하고 복사!!!! 이렇게 해야 복사본과 key가 다르게 됨, id는 동일함 

            // userId 변경
            if (toUserId && toUserId.length > 0) {
                _item.userId = toUserId;
            }

            // downloaderId
            if (downloaderId && downloaderId.length > 0) {
                _item.downloaderId = downloaderId;
            }

            // 여기서 이미지 복사
            if (item.type == NPItemType.pageTemplate) {
                if (item.userId !== toUserId) {
                    this._copyImageOfItemObjects(item as NPPageTemplate, _item, toUserId);
                }
            }

            // auth
            if (toUserId == 'public') {
                _item.auth = NPAuth.public
            }

            // copy cover image
            if (_item.coverImageURI) {
                _log('copyItem _item.coverImageURI =>', _item.coverImageURI);
                _item.coverImageURI = await this.copyImage(item.coverImageURI, toUserId, item.userId);
            }

            // sticker : 확장된 타입이지만 imageURI 밖에 추가가 없어서
            if (_item.imageURI) {
                _item.imageURI = await this.copyImage(_item.imageURI, toUserId, item.userId); // creatorId는 복사할 resource 위치
            }

            // pageTemplate's backgroundImageURI
            if (_item.backgroundImageURI) {
                _item.backgroundImageURI = await this.copyImage(_item.backgroundImageURI, toUserId, item.userId);
            }

            // pageTemplate's previewSvgURI
            if (_item.previewSvgURI) {
                _item.previewSvgURI = await this.copyImage(_item.previewSvgURI, toUserId, item.userId);
            }

            // pageTemplate's object복사 // 메모리상의 item의 경우 objects는 item안에 있음 
            // if (_item.type == NPItemType.pageTemplate && !exceptSaveObjectsCollection) {
            //     await this.setTemplate(_item);
            // }

            // copy child items
            if (this._isItemCanHaveChildren(item) && toUserId) {
                let children = await this.listChildrenOfParentItem(item); // toUserId : public, 받는자, 다운로드 할 떄 문제가 될 수 있음
                _log('copyItem children =>', children);
                let leftChildCount: number = children.length;
                for (let child of children) {
                    // 만약에 childItem이 template이면 objects도 가져와야 한다.  getItemByKey
                    if (child.type == NPItemType.pageTemplate) {
                        child = await this.getItemByKey(NPItemType.pageTemplate, child._key);
                    }
                    // 다운르도 속도 개선 : await안씀
                    this.copyItem(child, toUserId, downloaderId).then((cloneItem: NPItem) => {
                        cloneItem.parentItemKey = _item._key;
                        // db에 저장
                        this.setItem(cloneItem, toUserId);
                        leftChildCount--;
                        if (leftChildCount == 0) {
                            if (onDownloadComplete) {
                                onDownloadComplete(_item);
                            }
                        }
                    });
                }
            } else {
                if (onDownloadComplete) {
                    onDownloadComplete(_item);
                }
            }

            // 수정 날짜 변경
            _item.updateDate = CFDate.nowAsString();

        } catch (e: any) {
            _log('copyPageTemplate error =>', e);
            throw new Error(e);
        }
        return _item;
    }

    // item중에서 note, pageTemplate 만 object를 가지고 있다. (지금은 복사는 template만 함 )
    // 이 함수는 이미 같은 objects 끼리 image만 복사 함 
    // 이 함수는 권한 때문에 admin 또는 템플릿 만든이만 가능함 
    // 발행 시 : creator -> public 
    // 다운 시 : public -> me 
    // 노트 말들 때 : me -> me // 이떄는 복사하지 말아야 
    private async _copyImageOfItemObjects(srcItem: NPPageTemplate, destItem: NPPageTemplate, toUserId: string) {
        _flog(this._copyImageOfItemObjects, arguments);
        let fbUriPrefix = environment.firebaseStorageUrl;    // 복사 대상 이미지URI
        _valid(srcItem.type == destItem.type);
        if (!srcItem.objects || srcItem.objects.length == 0) { return; }
        // _valid(srcItem.objects && destItem.objects);
        // _valid(srcItem.objects.length && destItem.objects.length);
        _valid(srcItem.userId !== destItem.userId);

        let i = 0;
        for (let object of srcItem.objects) {
            if (object.type && object.type == 'image' && object.src && object.src.substring(0, fbUriPrefix.length) == fbUriPrefix) {
                _log('_copyImageOfItemObjects::from object.src', object.src);
                object.src = await this.copyImage(object.src, toUserId, object.userId);
                _log('_copyImageOfItemObjects::to object.src', object.src);
            }
        }
    }

    private _getChildItemTypes(type: NPItemType): Array<NPItemType> {
        let types: Array<NPItemType> = [];
        if (type == NPItemType.folder) {
            types = [NPItemType.folder, NPItemType.note];
        } else if (type == NPItemType.pageTemplatePack) {
            types = [NPItemType.pageTemplate];
        } else if (type == NPItemType.stickerPack) {
            types = [NPItemType.sticker];
        }
        _log('_getChildItemTypes types =>', types);
        return types;
    }

    // 특정아이템타입이 root 가져옴
    async listItem(type: NPItemType, loginedUserId: string, listType: NPItemListType, parentItemKey?: string, order: FBOrderDirection = FBOrderDirection.desc,
        useCache: boolean = true, tags?: Array<string>) {
        _valid(listType);
        // 노트를 가져올때는 이것을 사용하면 안됨, 휴지통등 아직 통함 안됨 
        //_valid(type !== NPItemType.note);
        let filter = this._makeItemListFilter(loginedUserId, listType, parentItemKey, tags);
        _log('listItem listType, filter =>', listType, filter);
        let _items: Array<NPItem> = await this.api.listByFilter(type, filter, false, useCache, useCache, 'updateDate', order, 1000);
        return _items;
    }

    private _makeItemListFilter(loginedUserId: string, listType: NPItemListType, parentItemKey: string = '', tags?: Array<string>) {
        let filter: any = {};
        _valid(listType);
        if (listType == NPItemListType.myCreated) {
            // 내가 만든 아이템 // 루트
            _valid(loginedUserId);
            filter = { creatorId: loginedUserId, userId: loginedUserId, downloaderId: '' };
        } else if (listType == NPItemListType.myDownloaded) {
            // 내가 받은 아이템
            _valid(loginedUserId);
            filter = { userId: loginedUserId, downloaderId: loginedUserId };
        } else if (listType == NPItemListType.my) {
            filter = { userId: loginedUserId }
        } else {
            _valid(false);
            throw new Error();
        }

        // parentKey '' 는 root
        filter['parentItemKey'] = parentItemKey;
        //Object.assign(filter, { parentItemKey: parentItemKey });    

        // tags
        if (tags && tags.length > 0) {
            filter['tags'] = tags;
        }

        return filter;
    }


    // private _isTypeCanHaveChildren(type: NPItemType): boolean {
    //     return (type == NPItemType.folder || type == NPItemType.pageTemplatePack || type == NPItemType.stickerPack);
    // }

    private _isItemCanHaveChildren(item: NPItem) {
        _valid(item);
        return (item.type == NPItemType.folder || item.type == NPItemType.pageTemplatePack || item.type == NPItemType.stickerPack);
    }

    // parent를 넣고 하위에 다양한 타입의 아이템 모두 가져옴
    async listChildrenOfParentItem(parentItem: NPItem, useCache: boolean = true, order: FBOrderDirection = FBOrderDirection.desc) {
        _valid(parentItem);
        _flog(this.listChildrenOfParentItem, arguments);
        _valid(this._isItemCanHaveChildren(parentItem))
        if (!(this._isItemCanHaveChildren(parentItem))) { return []; }
        //return this.listChildrenItem(parentItem.type, loginedUserId, parentItem, NPItemListType.my, useCache, order); 

        // _valid(loginedUserId);
        // if (!loginedUserId) { throw new Error(); }
        // let filter;
        // _valid(listType);
        // if(listType == NPItemListType.myCreated) {
        //     // 내가 만든 아이템 // 루트
        //     _valid(loginedUserId);
        //     filter = { creatorId: loginedUserId, userId: loginedUserId, downloaderId: ''};
        // } else if(listType == NPItemListType.myDownloaded) {
        //     // 내가 받은 아이템
        //     _valid(loginedUserId);
        //     filter = { userId: loginedUserId, downloaderId: loginedUserId };
        // } else if (listType == NPItemListType.my) {
        //     filter = { userId: loginedUserId }
        // } else {
        //     _valid(false);
        //     throw new Error();
        // }

        // parentKey '' 는 root
        //Object.assign(filter, { parentItemKey: parentItemKey }); 

        let items: Array<NPItem> = [];
        let childTypes = this._getChildItemTypes(parentItem.type);
        for (let childType of childTypes) {
            let _items: Array<NPItem> = await this.api.listByFilter(childType, { parentItemKey: parentItem._key, userId: parentItem.userId }, false, useCache, useCache, 'updateDate', order);
            items = items.concat(_items);
            _log('listChildrenItem childType, filter, _items, items =>', childType, _items, items);
        }
        return items;
    }

    // loginedUserId : 권한 체크를 위해서 받음
    // async listChildrenItem(parentType: NPItemType.folder | NPItemType.pageTemplatePack | NPItemType.stickerPack, 
    //     loginedUserId: string, parentItem: NPItem, listType: NPItemListType, useCache: boolean = true, order: FBOrderDirection = FBOrderDirection.desc) {
    //     _flog(this.listChildrenItem, arguments);
    //     _valid(loginedUserId);
    //     if (!loginedUserId) { throw new Error(); }
    //     let items: Array<NPItem> = [];
    //     let filter = this._makeItemListFilter(loginedUserId, listType, parentItem._key);
    //     let childTypes = this._getChildItemTypes(parentType);
    //     for(let childType of childTypes) {
    //         let _items: Array<NPItem> = await this.api.listByFilter(childType, filter, false, useCache, useCache, 'updateDate', order); 
    //         items = items.concat(_items);    
    //         _log('listChildrenItem childType, filter, _items, items =>', childType, filter, _items, items);
    //     }
    //     return items;
    // }

    async updateItemCoverFromFile(item: NPItem, uri: string) {
        _log('updateItemCoverFromFile type, uri =>', item.type, uri);
        item.coverImageURI = uri;
        return this.api.set(item.type, item._key, item);
    }

    /* -------------------------------------------------------------------------- */
    /*                           #pagetemplate #template                          */
    /* -------------------------------------------------------------------------- */

    // #todo : 템플릿을 가져오는 곳에 data cache 필요, 어차피 템플릿은 노트에서 안바뀜
    async getPageTemplate(key: string, userCache: boolean = true): Promise<NPPageTemplate | null> {
        _valid(key != null);
        let template = await this.api.get('NPPageTemplate', key);
        _valid(template);
        if (!template) { return null; }
        let objects = await this.api.getCollection(`NPPageTemplate/${template._key}/objects`, template.userId, true, userCache); // !!
        _valid(objects);
        template.objects = objects;
        if (!_valid(template)) {
            throw Error();
        };
        _log('getPageTemplate template =>', template);
        return template;
    }

    // 빈 페이지 템플릿을 생성
    async createPageTemplate(userId: string, name: string = '제목없음', width: number = 360, height = 509, parentItemKey = ''): Promise<NPPageTemplate> {
        _flog(this.createPageTemplate, arguments);
        if (width < 300 || width > 1024 || height < 300 || height > 1024) return new Promise(() => {
            throw new Error();
        })
        let template = new NPPageTemplate(name, userId, width, height, parentItemKey);
        template = await this.api.create('NPPageTemplate', template);

        // 생성 시 objects만들 필요 없음
        // _log('createTemplate _template =>', _template);
        // if (template.objects) {
        //     await this.api.setCollection(`NPPageTemplate/${_template._key}/objects`, _template.objects);
        // }
        return template;
    }

    // async getTemplateById(id: string, userId: string) {
    //     return new Promise((resolve, reject) => {
    //         return this.api.get('NPPageTemplate', { id_userId: `${id}_${userId}` }).then(resp => {
    //             _log('CFNoteAPI::getTemplateById resp =>', resp);
    //             if (!resp || !resp.list || resp.list.length < 1) { reject(); }
    //             resolve(resp.list[0]);
    //         }).catch(() => { reject(); });
    //     });
    // }

    // 공개된 템플릿 중에서 나에게 같은 id의 pageTemplate이 있는지?
    // async hasPageTemplate(template: NPPageTemplate, userId: string) : Promise<boolean> {
    //     _valid(template.id);
    //     return new Promise((resolve, reject) => {
    //         this.api.getByFilter('NPPageTemplate', {id_userId: `${template.id}_${userId}`}).then((resp: any) => {
    //             _log('CFNoteAPI::hasTemplateWith resp =>', resp);
    //             if (!resp) { resolve(false); }
    //             resolve(true);
    //         }).catch(() => { reject(); });
    //     });
    // }

    // 내가 만든 템플릿 인지?
    // isPageTemplateICreate(template: NPPageTemplate, userId: string) {
    //     return (template.creatorId == userId);
    // }

    // 내 페이지 템플릿 
    // async listMyPageTemplates(userId: string): Promise<Array<NPPageTemplate>> {
    //     return this.api.listByFilter('NPPageTemplate', {userId: userId}, false, 'updateDate', FBOrderDirection.desc);
    // }  

    // 내가 만든 페이지 템플릿 : 내가 만들고, 내가 받은게 아닌것
    // async listMyCreatedPageTemplates(userId: string): Promise<Array<NPPageTemplate>> {
    //     return this.api.listByFilter('NPPageTemplate', { creatorId: userId, userId: userId, downloaderId: ''}, false, 'updateDate', FBOrderDirection.desc);
    // }  
    async listPageTemplatesAvailableForNote(note: NPNote, currTemplatePack: NPPageTemplatePack) {
        _valid(note);
        _valid(currTemplatePack);
        let templateList = await this.listChildrenOfParentItem(currTemplatePack) as Array<NPPageTemplate>;
        _log('listPageTemplatesAvailableForNote templates, note =>', templateList, note);
        if (!note || !templateList) { return []; }
        let sameTemplates: Array<NPPageTemplate> = [];
        for (let template of templateList) {
            if (template.width == note.width && template.height == note.height) {
                sameTemplates.push(template);
            }
        }
        return sameTemplates;
    }

    // 내가 만들 노트 충 현재노트와 크기가 같은 노트 
    async listMyCreatedPageTemplatesAvailableForNote(userId: string, note: NPNote) {
        let createdTemplates = await this.listItem(NPItemType.pageTemplate, userId, NPItemListType.myCreated) as Array<NPPageTemplate>;
        _log('listMyCreatedPageTemplatesAvailableForNote createdTemplates, note =>', createdTemplates, note);
        if (!createdTemplates) { return []; }
        let sameTemplates: Array<NPPageTemplate> = [];
        for (let template of createdTemplates) {
            if (template.width == note.width && template.height == note.height) {
                sameTemplates.push(template);
            }
        }
        return sameTemplates;
    }

    // 내가 만든 템플릿 중 현재 템플릿팩의 크기와 같은 템플릿
    async listMyCreatedPageTemplatesAvailableForPack(userId: string, templatePackKey: string) {
        let templatePack = await this.getItemByKey(NPItemType.pageTemplatePack, templatePackKey);
        let createdTemplates = await this.listItem(NPItemType.pageTemplate, userId, NPItemListType.myCreated) as Array<NPPageTemplate>;
        if (!createdTemplates) { return []; }
        let sameTemplates: Array<NPPageTemplate> = [];
        for (let template of createdTemplates) {
            if (template.width == templatePack.width && template.height == templatePack.height) {
                sameTemplates.push(template);
            }
        }
        return sameTemplates;
    }

    // 내가 만든 템플릿팩 중 현재노트와 크기가 같은 템플릿팩
    async listMyCreatedTemplatePackAvailableForNote(userId: string, note: NPNote) {
        let createdPacks = await this.listItem(NPItemType.pageTemplatePack, userId, NPItemListType.myCreated) as Array<NPPageTemplatePack>;
        if (!createdPacks) { return []; }
        let samePacks: Array<NPPageTemplatePack> = [];
        for (let pack of createdPacks) {
            if (pack.width == note.width && pack.height == note.height) {
                samePacks.push(pack);
            }
        }
        return samePacks;
    }

    // type: NPItemType, loginedUserId: string, listType: NPItemListType, parentItemKey?: string, order: FBOrderDirection = FBOrderDirection.desc, 
    //     useCache: boolean = true, tags?: Array<string>) {

    // 내가 다운받은 템플릿팩 중 현재노트와 크기가 같은 템플릿팩
    async listMyDownloadedTemplatePackAvailableForNote(userId: string, note: NPNote, tags?: Array<string>) {
        let downloadedPacks = await this.listItem(NPItemType.pageTemplatePack, userId, NPItemListType.myDownloaded, '', FBOrderDirection.desc, true, tags) as Array<NPPageTemplatePack>;
        if (!downloadedPacks) { return []; }
        let samePacks: Array<NPPageTemplatePack> = [];
        for (let pack of downloadedPacks) {
            if (pack.width == note.width && pack.height == note.height) {
                samePacks.push(pack);
            }
        }
        return samePacks;
    }

    // 내가 다운로드 한 속지 충 현재노트와 크기가 같은 속지 
    async listMyDownloadedPageTemplatesAvailableForNote(userId: string, note: NPNote, tags?: Array<string>) {
        let downloadedTemplates = await this.listItem(NPItemType.pageTemplate, userId, NPItemListType.myDownloaded, '', FBOrderDirection.desc, true, tags) as Array<NPPageTemplate>;
        if (!downloadedTemplates) { return []; }
        let sameTemplates: Array<NPPageTemplate> = [];
        for (let template of downloadedTemplates) {
            if (template.width == note.width && template.height == note.height) {
                sameTemplates.push(template);
            }
        }
        return sameTemplates;
    }

    // 내가 다운로드 한 속지 충 template id가 같은 속지 // 노트에 지정 속지(default)를 찾기 위해
    async getTemplateOfMyDownloadedTemplatesByTemplateId(templateId: string, pageTemplatePackProductKey: string,  userId: string, note: NPNote, tags?: Array<string>) {
        _flog(this.getTemplateOfMyDownloadedTemplatesByTemplateId, arguments);
        let templates: NPPageTemplate[] = await this.getTemplatesOfAvailableWithProductKey(userId, note,  pageTemplatePackProductKey);
        templates = templates.filter((item: NPPageTemplate) => item.id == templateId);
        let template: NPPageTemplate | undefined;
        // 그중에 updateDate가 가장 최신인 것을 찾음
        if (templates.length > 0) {
            template = templates.reduce((latest, item) => 
                new Date(item.updateDate ?? 0) > new Date(latest.updateDate ?? 0) ? item : latest
            );
        }
        _log('getTemplateOfMyDownloadedTemplatesByTemplateId  template, templates =>', template, templates);
        return template;
    }

    async getTemplatesOfAvailableWithProductKey(userId: string, note: NPNote, productKey: string): Promise<NPPageTemplate[]> {
        _flog(this.getTemplatesOfAvailableWithProductKey, arguments);
        let templatePacks = await this.listMyDownloadedTemplatePackAvailableForNote(userId, note);
        _log('getTemplateOfAvailableWithProductKey templatePacks =>', templatePacks);
        templatePacks = templatePacks.filter((item: NPPageTemplatePack) => item.productKey == productKey);
        _valid(templatePacks && templatePacks.length > 0);
        _valid(templatePacks.length == 1);
        return await this.loadTemplateWidthTempatePack(templatePacks[0], note);
    }

    async loadTemplateWidthTempatePack(templatePack: NPPageTemplatePack, note: NPNote): Promise<NPPageTemplate[]> {
        _flog(this.loadTemplateWidthTempatePack, arguments);
        let templates: Array<NPPageTemplate> = [];
        _valid(templatePack);
        if (!templatePack) { return []; }
        _log('loadTemplateWidthTempatePack templatePack =>', templatePack);
        let _templates = await this.listPageTemplatesAvailableForNote(note, templatePack);
        for (let _template of _templates) {
            CFHelper.array.pushUniqueItemInArray(_template, templates);
        }
        _log('loadTemplateWidthTempatePack templates =>', templates);
        return templates
    }


    // 내가 다운로드한 노트 중 상품키가 같은 노트 
    async notesOfMyDownloadedNotes(userId: string, productKey: string) {
        let notes = await this.listMyNotes(userId, [], false);
        _log('notesOfMyDownloadedNotes notes =>', notes);
        if (!notes) { return []; }
        return notes.filter((note) => (note.productKey == productKey));
    }


    // 내가 다운로드한 템플릿 - 내가 가진 노트중 내가 만든건 뺌 
    // async listMyDownloadedPageTemplates(userId: string): Promise<Array<NPPageTemplate>> {
    //     let list: Array<NPPageTemplate> = [];
    //     let templates = await this.api.listByFilter('NPPageTemplate', {userId: userId, downloaderId: userId}, false, 'updateDate', FBOrderDirection.desc);
    //     _log('listMyDownloadedPageTemplates templates =>', templates);
    //     return new Promise((resolve, reject) => {
    //         if (!templates) { reject({})}
    //         for(let item of templates) {
    //             list.push(item);
    //         }
    //         resolve(list);
    //     });
    // }

   


    // async listTemplatesInNote(noteContent: NPNoteContent) {
    //     return this.api.listByKeys('NPPageTemplate', noteContent.templates);
    // }

    // 발행 된 페이지템플릿 리스트
    // async listPublicTemplates() {
    //     return this.api.listByFilter('NPPageTemplate', {isPublished: true}, false, 'updateDate', FBOrderDirection.desc);
    // }

    // 공개 된 페이지템플릿 리스트
    // async listPublicTemplates() {
    //     return this.api.listByFilter('NPPageTemplate', {isPublished: true});
    // }


    // pageTemplate는 전체가 아니라 바뀌 값
    async updateTemplate(templateKey: string, changedProperties: any) {
        _log('updateTemplate templateKey, changedProperties =>', changedProperties);
        return this.api.update('NPPageTemplate', templateKey, changedProperties);
    }

    // 템플릿 previewSVG저장할 때, 이름바꿀때, copyItem할때
    async setTemplate(template: NPPageTemplate, userId: string, isSaveObjects: boolean = true) {
        _log('setTemplate template, loginedUserId, isSaveObjects =>', template, userId, isSaveObjects);
        _valid(userId);
        let _template = CFHelper.json.deepClone(template);


        // 이 버그는 외부에서 setTemplate할 때 isSaveObjects를 넣어줘서 처리하기로

        // objects자체가 없을떄는 그냥 object를 저장안한다.
        // objects = []; 로 잘못 갖고 있을 때 저장을 하게 되면서 문제가 됨, 이름을 바꾸고  setTemplate할때 오브젝트가 날아감
        // 날아갈 것을 대비해서 objects = []일때 정말 인지 다시 가져옴
        // if (needReloadTemplate && _template.objects && _template.objects.length == 0) {
        //     let regetTemplate;
        //     try {
        //         regetTemplate = await this.getPageTemplate(template._key, false); 
        //     } catch(e) {
        //         regetTemplate = _template;
        //     }
        //     _template = regetTemplate;
        // }
        if (isSaveObjects && _template.objects) {
            await this.api.setCollection(`NPPageTemplate/${_template._key}/objects`, _template.objects, true, ['text'], false, userId);
        }
        delete _template.objects;
        return this.api.set('NPPageTemplate', _template._key, _template);
    }

    async updatePageTemplateObject(template: NPPageTemplate, _params: any, userId: string) {
        _log('updatePageTemplateObject template.objects.length, params =>', template.objects.length, _params);
        _valid(template);
        let params: IUpdateObjectParams = _params as IUpdateObjectParams;
        //let pageKey = params.pageKey; // tempateKey
        let object = params.object;
        let action = params.action;     // update, insert, delete

        //_valid(object.height > 0, 'height가 0인 오브젝트의 저장 시도');
        // if (object.height == 0) {   
        //     return; 
        // }

        let objPath = `NPPageTemplate/${template._key}/objects/${object._key}`;
        if (action == UpdateObjectActionType.update || action == UpdateObjectActionType.add) {
            this.setTemplateObject(template, object, userId);
        } else if (action == UpdateObjectActionType.updateObjects) {
            let objects = object;
            _log('updatePageObject::updatObjects objects =>', objects);
            for (let _object of objects) {
                this.setTemplateObject(template, _object, userId);
            }
        } else if (action == UpdateObjectActionType.delete) {
            await this.api.deleteByNode(objPath);
            await this.repositionTemplateObjects(template);    // 추가 할때 마지막 item.seq + 1이 아니라 현재 objects의 index를 저장하기 때문에 reposition해줘야 함
        } else if (action == UpdateObjectActionType.reorder) {
            await this.repositionTemplateObjects(template);
        }
        return template;
    }

    async updatePageTemplateObjectsDiffer(templat: NPPageTemplate, oldObjects: Array<any>, newObjects: Array<any>, userId: string) {
        let pagePath = `NPPageTemplate/${templat._key}`;
        return this._updatePageDifferByPagePath(pagePath, oldObjects, newObjects, userId);
    }

    async setTemplateObject(template: NPPageTemplate, object: any, userId: string): Promise<any> {
        _valid(template);
        _valid(userId);

        _log('setTemplateObject template, object =>', template, object);
        // seq
        let seq = template.objects.findIndex(_object => _object._key == object._key);
        _valid(seq !== -1);
        if (seq < 0) { return template; }
        _log('setTemplateObject template, object, objectIndex, seq =>', template, object, seq);

        let objPath = `NPPageTemplate/${template._key}/objects/${object._key}`;

        // save object
        let _object: any = await this.api.setByNode(objPath, object, true, ['text'], false, userId, seq);
        _log('setTemplateObject _object =>', _object);
        if (!_object) { throw new Error(); }
        _valid(_object);
    }

    async repositionTemplateObjects(template: NPPageTemplate) {
        _log('repositionTemplateObjects objects =>', template.objects); // 이미 삭제된 data
        let i = 0;
        for (let object of template.objects) {
            let objPath = `NPPageTemplate/${template._key}/objects/${object._key}`;
            await this.api.updateByNode(objPath, { seq: i });
            i++;
        }
    }

    // async updateTemplateData(template: NPPageTemplate, objectsJson: any) {
    //     return this.api.updateByNode(`NPPageTemplate/${template._key}/objects`, objectsJson);
    // }

    // canvas json으로 템플릿 업데이트
    // async updateTemplateFromJSON(template: NPPageTemplate, json: any, onlyItems: boolean = false) {
    //     _log('updateTemplateFromJSON template, json =>', template, json);
    //     if (!_valid(template != null)) { throw Error(); }

    //     // if (!onlyItems) {
    //     //     // background color
    //     //     template.backgroundColor = json.backgroundColor;

    //     //     // background image
    //     //     if (json.backgroundImage && json.backgroundImage.src) {
    //     //         template.backgroundImageURI = await this.createSvgResource(NPResourceType.svg, json.backgroundImage.src);
    //     //         template.coverImageURI = template.backgroundImageURI;
    //     //     }
    //     // }

    //     // items
    //     template.items = [];
    //     for(let obj of json.objects) {
    //         if (obj.type == 'textInputBox') {
    //             // 자체 object  : 데이타의 양을 줄임 // ??? 이게 필요한지 
    //             let targetObj:NPTextInputBox = new NPTextInputBox();
    //             _log('targetObj ', targetObj)
    //             copyObject(targetObj, obj);
    //             template.items.push(targetObj);
    //         } else {
    //             // 기타 object
    //             template.items.push(obj);
    //         }
    //     }
    //     _log('updateTemplateFromJSON template =>', template);
    //     if (onlyItems) {
    //         this.api.updateByNode(`NPPageTemplate/${template._key}/items`, template.items);
    //     } else {
    //         this.api.updateByNode(`NPPageTemplate/${template._key}`, template);
    //     }
    // }


    async deleteTemplate(template: NPPageTemplate, userId: string) {
        if (template.objects && template.objects.length > 0) {
            this.api.deleteCollection(`NPPageTemplate/${template._key}/objects`, userId);
        }
        return this.api.delete('NPPageTemplate', template._key);
    }


    // crefe 서버에서 받은 template를 가지고 user template를 만든다.
    // async createPrototypeTemplate(template: any, userId: string) {
    //     let _template = await this.api.getByFilter('NPPageTemplate', {id_userId: `${template.id}_${userId}`});
    //     if (_template) {
    //         throw new Error(); 
    //     }
    //     // userId를 변경한다.
    //     template.userId = userId;
    //     template.id_userId = `${template.id}_${userId}`;
    //     template.userId_isPrototype = `${userId}_1`;
    //     template.items = JSON.parse(template.items);
    //     template.bkSvgImageMobileKey = await this.createSvgResource(NPResourceType.svg, template.bkSvgImageMobile);
    //     template.bkSvgImageMobile = null;
    //     return this.api.create('NPPageTemplate', template);
    // }

    // 기존 템플릿을 내 템플릿으로 복사
    // 1. 스토어에서 템플릿을 다운로드 받았을 때 사용 함 
    // 2. 템플릿으로 노트를 만들거나 페이지 추가 할때 템플릿을 복사합니다. 복사를 하는 이유는 키중복, 리소스 삭제 시 등 문제
    // async downloadPageTemplate(template: NPPageTemplate, userId: string /*, duplicateCheck: boolean = false*/) {        
    //     _log('downloadPageTemplate template, userId =>', template, userId);
    //     //_flog(this.downloadPageTemplate, template, userId)
    //     if (!template.id || template.id.length == 0) {
    //         throw new Error(NPError.stickerFileReadFail);
    //     }

    //     // 이미 다운로드한 템플릿이 있는지?
    //     // if (duplicateCheck) {
    //     //     let sameTemplate = await this.api.getByFilter('NPPageTemplate', {id: template.id, userId: userId});
    //     //     if (sameTemplate) {
    //     //         throw new Error(NPError.sameItem);
    //     //     }
    //     // }

    //     let _template = await this.copyItem(template, userId);
    //     _template.downloaderId = userId;
    //     return this.setTemplate(_template);
    //     //return this.api.create('NPPageTemplate', _template);
    // }   

    // async copyPageTemplate(template: NPPageTemplate) {
    //     // 기본 template 값 복사 
    //     let _template = new NPPageTemplate('', '', 0, 0);
    //     CFHelper.object.copyValue(_template, template, '_key');    // 키를 제외하고 복사!!!! 이렇게 해야 복사본과 key가 다르게 됨

    //     try {
    //         // copy bk image
    //         if (template.backgroundImageURI) {
    //             _template.backgroundImageURI = await this.copyImage(template.backgroundImageURI, template.creatorId);
    //         }

    //         // copy cover image
    //         if (template.coverImageURI) {
    //             _template.coverImageURI = await this.copyImage(template.coverImageURI, template.creatorId);
    //         }

    //         // copy previewSvgURI
    //         if (template.previewSvgURI) {
    //             _template.previewSvgURI = await this.copyImage(template.previewSvgURI, template.creatorId);
    //         }
    //     } catch(e: any) {
    //         _log('copyPageTemplate error =>', e);
    //         throw new Error(e);
    //     }

    //     // 날짜 변경
    //     _template.updateDate = CFDate.nowAsString();
    //     return _template;
    // }

    // 자체 svg와 스토어에 올라간 이미지만 복사가 가능함
    public async copyImage(imageURI: string, toUserId: string, fromUserId: string, auth: NPAuth = NPAuth.private) {
        let image: INPImage = await this.getImage(imageURI);
        _log('_copyImage imageURI, toUuserId, fromUserId, image =>', imageURI, toUserId, fromUserId, image);
        let copiedURI: string | undefined;

        if (image.type == NPImageType.svg) {
            copiedURI = await this.copySvgResource(imageURI, toUserId, fromUserId, auth);
        } else {
            try {
                _valid(this.app);
                const functions = getFunctions(this.app, FBFunctionsRegion);
                if (!functions) { throw new Error('이미지 복사 함수를 얻지 못했습니다.'); }

                let storageBucket = environment.firebaseConfig.storageBucket;
                if (imageURI.indexOf(storageBucket) > -1) {
                    let index = imageURI.indexOf('userContent');

                    if (index == -1) {
                        throw new Error('이미지주소가 허용하지 않는 주소입니다.');
                    }

                    let srcFilePath = imageURI.substring(index);
                    srcFilePath = decodeURIComponent(srcFilePath.split('?')[0]);
                    _log('_copyImage srcFilePath =>', srcFilePath);

                    let _paths = srcFilePath.split('/');
                    let fileName = _paths[_paths.length - 1];
                    let destFilePath = `userContent/${toUserId}/images/${CFHelper.id.generateIdDateType()}_${fileName}`;
                    destFilePath = decodeURIComponent(destFilePath.split('?')[0]);
                    _log('_copyImage srcFilePath, destFilePath =>', srcFilePath, destFilePath);
                    const copyImage_firebaseFunction = httpsCallable(functions, 'copyImage');
                    let result = await copyImage_firebaseFunction({
                        srcFilePath: srcFilePath,
                        destFilePath: destFilePath
                    });
                    _log('_copyImage result =>', result);
                    copiedURI = result.data as string;
                } else {
                    alert('내부오류 : 이미지복사 중 오류 : 다른 서버에서 등록한 이미지의 복사를 시도 하였습니다.');
                }
            } catch (e: any) {
                _log('_copyImage error =>', e);
                throw new Error(e);
            }
        }
        if (!copiedURI) {
            throw new Error();
        }
        return copiedURI;
    }


    // 미사용
    // async listPrototypeTemplate(userId: string): Promise<Array<any>> {
    //     return new Promise((resolve, reject) => {
    //         this.api.listByFilter('NPPageTemplate', {userId_isPrototype: `${userId}_1`}).then((resp: any[] | PromiseLike<any[]>) => {
    //             _log('listPrototypeTemplate resp =>', resp);
    //             resolve(resp);
    //         }).catch(() => { reject(); });
    //     });
    // }


    // 퍼블리싱 
    // 우선은 간단히 공개하고 id만 부여 한다.
    // async publishTemplate(template: NPPageTemplate) {
    //     _valid(template != null);
    //     _log('publishTemplate template =>', template);

    //     // 이미 퍼블리싱 되어도 아이디가 없으면 새로 부여하기 위해 주석처리
    //     // if (template.isPublished) { return; }

    //     template.isPublished = true;
    //     // 처음 퍼블리싱이면 새로운 아이디를 부여 한다.
    //     if (!template.id) {
    //         template.id = CFHelper.id.generateUUID();
    //         template.id_userId = `${template.id}_${template.userId}`;
    //     }
    //     let resp = await this.updateTemplate(template);
    //     return resp;
    // }



    // 기본 템플릿 생성
    // public async createDefaultTemplates(userId: string) {
    //     this._createDefaultTemplate(userId, DefaultTemplateIds.ID_TEMPLATE_BLANK_BASIC_MEMO_1);
    //     this._createDefaultTemplate(userId, DefaultTemplateIds.ID_TEMPLATE_BLANK_BASIC_NOTE_1);
    // }

    // private async _createDefaultTemplate(userId: string, templateId: string) {
    //     // get template memo 1
    //     let templateMemo1: any = await this.getTemplateById(templateId, userId);
    //     _log("CFNoteStore::createDefaultTemplate templateMemo1 =>", templateMemo1);
    //     if (!templateMemo1) return;

    //     // get user's template memo 1
    //     this.hasTemplateWithId(templateId, userId).then((resp: any) => {
    //         _log("CFNoteStore::createDefaultTemplate::hasTemplateWithId resp =>", resp);
    //         if (!resp)  {
    //             this.cloneTemplate(templateMemo1, userId);
    //         }
    //     }).catch(() => {

    //     });
    // }


    /* -------------------------------------------------------------------------- */
    /*                                    #note                                   */
    /* -------------------------------------------------------------------------- */

    /*
        orm은 아님 
        여기의 object는 db에 저장단위이지 runtime의 구조와 동일하게 맞추려 하지 않음
    */
    /*
        구조
        -----------
        note
            info                               
        noteContent
            pages: [page...], template: [template...]   // 노트를 열었을때 페이지 정보


        API
        -----------
        note
            create      ?
            get         ?   
            getPages    ?
            list        ?
            delete      ?   // notePage도 같이 지워야 함
            update      ?   // note만 수정 
        pages
            create      ?   // 노트를 만들때 같이 만들어야 함
            delete page ?   // 특정 페이지 삭제 
            update page ?   // 특정 페이지 수정
        service
            createNoteFromTemplate  ?     
    */

    // create
    async createNoteFromTemplate(template: NPPageTemplate, userId: string, noteName: string = '제목없음',
        pageBgColor: string = '', defaultViewMode: NoteViewMode = NoteViewMode.edit,
        isAddForward: boolean = true, isOpenFromLastPage: boolean = false, productKey?: string, tags: Array<string> = [],
        isCratePage: boolean = true, listType: NoteListType = NoteListType.list, 
        holidayDisplayType: NoteHolidayDisplayType = NoteHolidayDisplayType.none,
        calSkinId: CalSkinIds = CalSkinIds.SkinDrawingCalendar): Promise<NPNote | null> {

        if (!_valid(userId != null, "노트를 생성하기 위해 userId가 필요합니다.")) {
            return null;
        }

        // 노트 만듦
        let coverImageUri: string = template.coverImageURI;
        if (coverImageUri) {
            let image: INPImage = await this.parseURI(coverImageUri);
            if (image.type == NPImageType.svg) {
                let _coverImageUri = await this.copySvgResource(coverImageUri, userId, template.userId);
                _valid(_coverImageUri && _coverImageUri.length > 0);
                if (_coverImageUri && _coverImageUri.length > 0) {
                    coverImageUri = _coverImageUri;
                }
            }
        }

        let note: NPNote = new NPNote(noteName, userId, coverImageUri, template.width, template.height,
            defaultViewMode, isAddForward, isOpenFromLastPage, false, productKey, tags, listType, holidayDisplayType, calSkinId);
        // single note로 만들면 tag에 appId를 추가한다. 필터에 사용하기 윗해
        note = await this.api.create('NPNote', note);
        _log('createNoteFromTemplate note =>', note);

        // Note Pages하나 만들고
        let noteContent: NPNoteContent = new NPNoteContent(note, userId);   // 여기서  key를 만들고
        await this.api.create('NPNoteContent', noteContent, noteContent._key);

        // 싱글노트에서는 초기에 페이지 추가가
        if (isCratePage) {
            await this.addPageWithOriPageTemplate(note, noteContent, template, userId, pageBgColor);
        }

        // noteContent : noteKey, 
        note.contentKey = noteContent._key;    // note, noteContent 서로 연결 한다. 
        await this.api.update('NPNote', note._key, { contentKey: noteContent._key });

        // #sync
        this.updateUpdateDateOfNoteList(userId); // 노트리스트에 변경이 있었음
        return note;
    }


    // function createName(originalName, existingNames) {
    //     let newName = originalName;
    //     let count = 1;
    //     while (existingNames.includes(newName)) {
    //       newName = originalName + "(" + count + ")";
    //       count++;
    //     }
    //     return newName;
    //   }

    // let existingNames = ["John", "Jane", "Mike"];
    // let newName = createName("John", existingNames);
    // console.log(newName); // "John(1)"
    // existingNames 배열에서 "John"이 이미 존재하기 때문에, createName() 함수는 "John(1)"을 반환합니다.

    // duplicateNote(userId: string, note: NPNote) {
    //     if (!_valid(userId != null, 257, "노트를 생성하기 위해 userId가 필요합니다.")) {
    //         return null;
    //     }

    //     // 노트 만듦
    //     // note.name - 새 이름 만들기
    //     let _note: NPNote = new NPNote(note.name, userId, template.coverImageURI, pages);
    //     return this.api.create('NPNote', _note);
    // }

    // async createNoteFromNote(userId: string, note: NPNote) {
    //     if (!_valid(userId != null, 257, "노트를 생성하기 위해 userId가 필요합니다.")) {
    //         return null;
    //     }

    /* 여기는 실제 삭제하는 코드 */
    // await  this.api.delete('NPNoteContent', note.contentKey);    
    // // note
    //          userId
    // //      coverImageURI
    // // tamplates/
    // //      coverImageURI
    // //      backgroundImageURI
    // return this.api.delete('NPNote', note._key);

    //     // 1. NPNote복자 
    // pageKey
    //     // 2. NPNoteContent 복사
    //     // 3. NPNoteContent - templates 복사 
    //     // 4. NPNoteContent - pages 복사 


    //     // 기본 페이지 하나 만들고
    //     //let page:NPPage = new NPPage(template._key);

    //     // pages하나 만들고
    //     // let pages: NPNoteContent = new NPNoteContent(page, template);   // 여기서  key를 만들고
    //     // pages = await this.api.create('NPNoteContent', pages);        // 여기서 db에서 새로운 키를 부여 받음, 그래서 기존 키가 바뀜

    //     // // 노트 만듦
    //     // let note: NPNote = new NPNote('제목없음', userId, template.coverImageURI, pages);
    //     // return this.api.create('NPNote', note);
    // }

    async getNote(key: string, userId: string, includeTrashedNote: boolean = true): Promise<NPNote | undefined> {
        _valid(key != null);
        return new Promise((resolve, reject) => {
            let filters: any = {
                _key: key,
                userId: userId
            };
            if (!includeTrashedNote) {
                filters['isDeleted'] = false;   // 미삭제된 노트
            }
            this.api.getByFilter('NPNote', filters).then((note: any) => {
                // _valid(note);
                if (!note) { resolve(undefined); }
                // if (!_valid(resp)) {
                //     throw Error();
                // };
                if (!note.defaultViewMode) {
                    note.defaultViewMode = NoteViewMode.edit;
                }
                // 데이타마이그레이션 : 이전 isShowListView가 true이면 NoteViewMode.grid값을 의미 함
                if (note.isShowListView) {
                    note.defaultViewMode = NoteViewMode.grid;
                }
                _log('CFNoteAPI::getNote key, note =>', key, note);
                resolve(note as NPNote);
            }).catch(() => { reject(); });
        });
    }

    async listNotesByProductKey(productKey: string, userId: string, isUseCache: boolean = true): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            if (!_valid(userId != null, "노트를 생성하기 위해 userId가 필요합니다.")) {
                reject();
            }
            this.api.listByFilter('NPNote', { userId: userId, isDeleted: false, productKey: productKey }, false, isUseCache, isUseCache, 'updateDate', FBOrderDirection.desc).then((resp: any[] | PromiseLike<any[]>) => {
                _log('listNotesByProductKey resp =>', resp);
                resolve(resp);
            }).catch(() => { reject(); });
        });
    }

    // 내 노트 리스트
    async listMyNotes(userId: string, tags: Array<string> = [], isUseCache: boolean = true): Promise<Array<any>> {
        _flog(this.listMyNotes, arguments);
        return new Promise((resolve, reject) => {
            if (!_valid(userId != null, "노트를 생성하기 위해 userId가 필요합니다.")) {
                reject();
            }
            let filters: any = { userId: userId, isDeleted: false };

            // tag 
            if (tags && tags.length > 0) {
                filters['tags'] = tags; // array contains any
            }

            // productKeys 
            // if (tags && tags.length > 0) {
            //     filters['productKey'] = { condition: 'in', field: productKeys };
            // }

            this.api.listByFilter('NPNote', filters, false, isUseCache, isUseCache, 'updateDate', FBOrderDirection.desc).then((list: any[]) => {
                _log('listMyNotes list =>', list);
                list = list.filter(item => item.productKey && item.productKey.length > 0) // 이전 blank노트를 제외한다. productKey가 있는 것
                resolve(list);
            }).catch(() => { reject(); });
        });
    }

    async listMyBookmarkNotes(userId: string, tags: Array<string> = []): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let filters: any = { userId: userId, isDeleted: false, isBookmark: true };
            if (tags && tags.length > 0) {
                filters['tags'] = tags;
            }
            this.api.listByFilter('NPNote', filters, false, true, true, 'updateDate', FBOrderDirection.desc).then((resp: any[] | PromiseLike<any[]>) => {
                _log('listMyBookmarkNotes resp =>', resp);
                resolve(resp);
            }).catch(() => { reject(); });
        });
    }
    // async listMyBookmarkNotes(userId: string) {
    //     return new Promise((resolve, reject) => {
    //         if (!_valid(userId != null, 286, "노트를 생성하기 위해 userId가 필요합니다.")) {
    //             reject();
    //         }
    //         this.api.listByFilter('NPNote', {userId: userId}).then((resp: any[] | PromiseLike<any[]>) => {
    //             _log('listMyNotes resp =>',resp);
    //             resolve(resp);
    //         }).catch(() => { reject(); });
    //     });
    // }

    // update

    async udpateNote(note: NPNote) {
        // #sync : 커버이미지 변경, 설정 번경의 경우
        return this.api.set('NPNote', note._key, note);
    }

    async updateNoteBookmark(key: string, isBookmark: boolean, userId: string) {
        let note: NPNote | undefined = await this.getNote(key, userId);
        if (!_valid(note != null)) { return; }
        if (!note) { return; }
        note.isBookmark = isBookmark;
        //NPNote.makeNoteFilter(note);
        return this.api.set('NPNote', key, note);
    }

    // async updatePageWithNote(note: { _key: null; pages: null; }) {
    //     if (!_valid(note != null && note._key != null, 297)) throw Error();
    //     if (!_valid(note.pages != null, 298)) throw Error(); 
    //     return this.api.update('NPNote', note._key, note.pages, 'pages');
    // }

    // async updateContent(noteKey: null, pageKey: null, itemKey: null, data: any) {
    //     if (!_valid(noteKey != null && pageKey != null && itemKey != null, 299)) return;
    //     return this.api.updateByNode(`NPNote/${noteKey}/pages/${pageKey}/items/${itemKey}/data/content`, data);
    // }


    /* -------------------------------------------------------------------------- */
    /*                                 #note #page                                */
    /* -------------------------------------------------------------------------- */

    // template로 page를 만듦
    // async createPageFromTemplate(template: NPPageTemplate): Promise<NPPage | undefined>  {
    //     if (!_valid(template._key != null, 182)) return;
    //     let page: NPPage = new NPPage(template);
    //     return page;
    // }

    /*


    */
    // getNotePageFromNoteCOntent(noteContent: )
    // let page: NPPage | undefined = noteContent.pages.find(page => page._key == viewPageKey);

    getPageFromNoteContent(noteContent: NPNoteContent, pageKey: string): NPPage | undefined {
        _valid(noteContent);
        _valid(noteContent.pages);
        return noteContent.pages.find(page => page._key == pageKey);
    }

    getPageNumberByPageKey(noteContent: NPNoteContent, pageKey: string) {
        let idx = 0;
        let pageIndex = noteContent.pages.findIndex((_page: NPPage) => _page._key == pageKey);
        _valid(pageIndex > -1);
        _log('getPageNumberByObjectKey noteContent, pageKey, pageIndex =>', noteContent, pageKey, pageIndex);
        return pageIndex > -1 ? pageIndex + 1 : 1;
    }

    getPageTimeString(noteContent: NPNoteContent, pageKey: string) {
        if (!noteContent) { return; }
        let page: NPPage | undefined = this.getPageFromNoteContent(noteContent, pageKey);
        if (!page) { return ''; }
        return this.getTimeStringOfPage(page);
    }

    getTimeStringOfPage(page: NPPage) {
        if (!page || !page.date) { return ''; }
        let timeString = page.date ? CFHelper.date.format(CFDateFormat.amhhmm, page.date) : '';
        return timeString;
    }

    async getNotePage(noteContentKey: string, pageKey: string, userId: string): Promise<NPPage> {
        _log('getNotePage noteContentKey, pageKey =>', noteContentKey, pageKey);
        let page: any = await this.api.getByPath(`NPNoteContent/${noteContentKey}/pages/${pageKey}`);
        // getCollection에서 objects의 변환을 해준다. 
        page.objects = await this.getNotePageObjects(noteContentKey, pageKey, userId);
        _log('getNotePage page =>', page);
        return page as NPPage;
    }

    async getNotePageObjects(noteContentKey: string, pageKey: string, userId: string): Promise<Array<any>> {
        _flog(this.getNotePageObjects, arguments);
        return await this.api.getCollection(`NPNoteContent/${noteContentKey}/pages/${pageKey}/objects`, userId, true);
    }

    async updatePage(noteContentKey: string, page: NPPage) {
        _log('updatePage noteContentKey, pageKey, isPublic =>', noteContentKey, page);
        if (!_valid(page != null)) { return; }

        // 페이지를 저장할 때 page.objects를 저장하면 안됨
        let _page: any = CFHelper.json.deepClone(page);
        delete _page.objects;
        _log('updatePage _page =>', _page);
        return this.api.setByNode(`NPNoteContent/${noteContentKey}/pages/${page._key}`, _page);
    }

    async updateGpsOfPage(noteContentKey: string, pageKey: string, gps: BLGPS) {
        _flog(this.updateGpsOfPage, arguments);
        if (!_valid(pageKey)) { return; }
        return this.api.updateByNode(`NPNoteContent/${noteContentKey}/pages/${pageKey}`, { gps: gps });
    }

    async updatePageData(noteContentKey: string, pageKey: string, fieldName: string, value: any) {
        _flog(this.updatePageData, arguments);
        if (!_valid(pageKey)) { return; }
        let data: any = {};
        data[fieldName] = value; 
        return this.api.updateByNode(`NPNoteContent/${noteContentKey}/pages/${pageKey}`, data);
    }

    async getNoteContentByNote(note: NPNote, userId: string, isLoadPages: boolean = true, isLoadObjects: boolean = true, userCache: boolean = false) {
        return this.getNoteContent(note.contentKey, userId, isLoadPages, isLoadObjects, userCache);
    }

    async getNoteContent(noteContentKey: string, userId: string, isLoadPages: boolean = true, isLoadObjects: boolean = true, userCache: boolean = false) {
        _log('getNoteContent noteContentKey =>', noteContentKey);
        // get NoteContent
        let noteContent: NPNoteContent = await this.api.get('NPNoteContent', noteContentKey, userCache);

        // 그냥 noteContent만 필요한 경우
        if (isLoadPages) {
            // get NoteContent/pages
            noteContent.pages = await this.api.getCollection(`NPNoteContent/${noteContent._key}/pages`, userId, undefined, userCache); // #pages            
        }

        if (isLoadObjects) {
            for (let page of noteContent.pages) {
                page.objects = await this.api.getCollection(`NPNoteContent/${noteContent._key}/pages/${page._key}/objects`, userId, true, userCache); // #pages
            }
        }

        // load template object
        this.prepareTemplateObjects(noteContent);

        _log('getNoteContent noteContent =>', noteContent);
        return _valid(noteContent);
    }

    prepareTemplateObjects(noteContent: NPNoteContent) {
        for (let template of noteContent.templates) {
            if (template.objects) {
                for (let object of template.objects) {
                    object = this.api._saveDocToDoc(object, true);
                }
            }
            _log('getNoteContent noteContent =>', noteContent);
        }
    }

    // // 페이지에 공감
    // async heartWithPage(noteContent: NPNoteContent, page: NPPage, userId: string) {
    //     let pageHeart = new NPPageHeart(noteContent._key, page._key, userId);
    //     return this.api.set('NPPageHeart', pageHeart._key, pageHeart);
    // }

    // // 페이지에 공감 해제
    // async unHeartWithPage(noteContent: NPNoteContent, page: NPPage, userId: string) {
    //     try {
    //         let pageHeart = await this.api.getByFilter('NPPageHeart', 
    //             { 
    //                 noteContentKey: noteContent._key,
    //                 pageKey: page._key,
    //                 userId: userId
    //             }
    //         )
    //         await this.api.delete(`NPPageHeart`, pageHeart._key);
    //     } catch (e) {

    //     }
    // }

    // // 이 페이지에 공감수
    // async getHeartCountOfPage(noteContent: NPNoteContent, page: NPPage) {
    //     let heartCount = 0;
    //     try {
    //         let pageHearts = await this.api.getByFilter('NPPageHeart', 
    //             { 
    //                 noteContentKey: noteContent._key,
    //                 pageKey: page._key
    //             }
    //         )
    //         if (pageHearts) {
    //             heartCount = pageHearts.length;
    //         }
    //     } catch (e) {

    //     }
    //     return heartCount;
    // }

    /* -------------------------------------------------------------------------- */
    /*                                    #data                                   */
    /* -------------------------------------------------------------------------- */
    hasPageOfDate(noteContent: NPNoteContent, date: Date) {
        let pages = this.getPagesByDate(noteContent.pages, date);
        return pages.length > 0;
    }

    getPagesByDate(pages: Array<NPPage>, date: Date): Array<NPPage> {
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        _log('getPagesByDate year, month, day =>', year, month, day);
        return this.getPagesByYearMonthDay(pages, year, month, day);
    }

    // 이 함수는 계속 불리니 주석 넣지 말기
    getPagesByYearMonthDay(pages: Array<NPPage>, year: number, month: number, day: number): Array<NPPage> {
        let _pages: Array<NPPage> = [];
        for (let page of pages) {
            if (page.date) {
                let _date = new Date(page.date);
                //_log('getPagesByDate _date,  _date.getDate() =>', _date,  _date.getDate());
                if (_date.getFullYear() == year && _date.getMonth() + 1 == month && _date.getDate() == day) {
                    _pages.push(page);
                }
            }
            // for(let object of page.objects) {
            //     if (object.dataType && object.dataType == NPDataType.date) {
            //         //_log('getPagesByDate date =>', object.date);
            //         let _date = new Date(object.date);
            //         //_log('getPagesByDate _date,  _date.getDate() =>', _date,  _date.getDate());
            //         if (_date.getFullYear() == year && _date.getMonth() + 1 == month && _date.getDate() == day) {
            //             _pages.push(page);
            //         }
            //     }
            // }
        }

        // isPrimaryOfDay를 _pages에 1개만 유지한다.
        let foundPrimary = false; // 첫 번째 isPrimaryOfDay를 찾았는지 여부
        for (let page of _pages) {
            if (page.isPrimaryOfDay) {
                if (foundPrimary) {
                    page.isPrimaryOfDay = false; // 중복 제거
                } else {
                    foundPrimary = true; // 첫 번째 true 값만 유지
                }
            }
        }

        //_log('getPagesByYearMonthDay pages, _pages =>', pages, _pages);
        return _pages;
    }

    async getMediaOfPage(noteContentKey: string, page: NPPage, userId: string): Promise<Array<NPMediaData>> {
        if (!page.objects || page.objects.length == 0) {
            try {
                _log('getMediaOfPage noteContentKey, page._key,  userId, page.objects =>', noteContentKey, page._key, userId, page.objects);
                page.objects = await this.getNotePageObjects(noteContentKey, page._key, userId);
            } catch (e) {
                throw new Error();
            }
        }
        return this._getMediaOfPage(page, noteContentKey);
    }

    async getDataTypeOfPage(page: NPPage, userId: string): Promise<NPPageDataContentType> {
        if (!page.objects || page.objects.length == 0) {
            try {
                _log('getDataOfPage noteContentKey, page._key,  userId, page.objects =>', page._key, userId, page.objects);
                page.objects = await this.getNotePageObjects(page.noteContentKey, page._key, userId);
            } catch (e) {
                throw new Error();
            }
        }
        return this._getDataTypeOfPage(page);
    }

    async getDataTypeByPage(page: NPPage, userId: string): Promise<NPPageDataContentType> {
        let pageData = await this.getDataOfPage(page, userId);
        return this.getDataTypeByPageData(pageData);
    }

    getDataTypeByPageData(pageData: NPPageData) {
        let hasText: boolean = pageData.title || pageData.content || (pageData.stickerUrls && pageData.stickerUrls.length > 0) ? true : false;
        let hasImage: boolean = (pageData.thumbImageUrl && pageData.thumbImageUrl.length > 0) ? true : false;
        let pageDataType: NPPageDataContentType = NPPageDataContentType.onlyText;
        if (hasText && hasImage) {
            pageDataType = NPPageDataContentType.textAndImage;
        } else if (hasImage) {
            pageDataType = NPPageDataContentType.onlyImage;
        }
        return pageDataType;
    }

    _getDataTypeOfPage(page: NPPage): NPPageDataContentType {
        _valid(page.objects);
        let pageDataType: NPPageDataContentType = NPPageDataContentType.onlyText;
        let hasText: boolean = false, hasImage: boolean = false;
        for (let object of page.objects) {
            if (object.type == fabricObjectType.textInputBox) {
                hasText = true;
            } else if (object.type == fabricObjectType.imageInputBox || object.type == fabricObjectType.drawingInputBox) {
                hasImage = true;
            }
        }
        if (hasText && hasImage) {
            pageDataType = NPPageDataContentType.textAndImage;
        } else if (hasImage) {
            pageDataType = NPPageDataContentType.onlyImage;
        }
        return pageDataType;
    }

    _getMediaOfPage(page: NPPage, noteContentKey: string): Array<NPMediaData> {
        let list: Array<NPMediaData> = [];
        for (let object of page.objects) {
            let data: NPMediaData = this._getMediaOfObject(object, page.date);

            // src가 있을 경우만 유효하다.
            if (data.src && data.src.length > 0) {
                data.noteContentKey = noteContentKey;
                data.pageKey = page._key;
                list.push(data);
            }
        }
        return list;
    }


    private _getThumbImageUrl(srcUrl: string, thumbUrl: string) {
        let url = srcUrl;
        if (thumbUrl) {
            url = thumbUrl.includes('_dark')? srcUrl : thumbUrl; // thumbUrl에 dark thumbnail이 있으면 그냥 원 이미지
        } 
        return url;
    }

    private _getThumbImageUrlDark(srcUrl: string, thumbUrl: string, thumbUrlDark: string) {
        let url = srcUrl;
        if (thumbUrlDark) {
            url = thumbUrlDark;
        } else if(thumbUrl && thumbUrl.includes('_dark')) {
            url = thumbUrl;
        }
        return url;
    }

    // 페이지에서 title content type을 찾아서  
    findTitleObjectFromPage(page:NPPage): any | undefined {
        _flog(this.findTitleObjectFromPage, arguments);
        for(let object of page.objects) {
            if (!object.dataType) { continue; }
            if (object.dataType == NPDataType.title) {
                return object;
            }
        }
        return undefined;
    }

    // page.objects가 없으면 안됨
    _getDataOfPage(page: NPPage): NPPageData {
        _flog(this._getDataOfPage, arguments);
        let data: NPPageData = { pageKey: page._key, numberOfImages: 0 };
        data.pageKey = page._key;
        data.isPrimaryOfDay = !!page.isPrimaryOfDay;
        data.previewSvgData = page.previewCacheSvg;

        let numberOfImages: number = 0;
        for (let object of page.objects) {
            if (object.dataType) {
                if (object.dataType == NPDataType.title) {
                    data.title = object.text;
                }
                if (object.dataType == NPDataType.content) {
                    data.content = object.text;
                }
                if (object.dataType == NPDataType.date) {
                    data.date = object.date;
                }
                if (object.dataType == NPDataType.photo) {
                    data.photoUrl = object.imageSrcUrl;
                    data.thumbImageUrl = object.thumbImageUrl? object.thumbImageUrl : object.imageSrcUrl;
                    data.thumbImageUrlDark = object.thumbImageUrlDark? object.thumbImageUrlDark : data.thumbImageUrl;  
                    data.isHoriOfthumbImage = this._isHoriOfImageObject(object);
                    data.thumbViewBox = {
                        left: object.left,
                        top: object.top,
                        width: object.width,
                        height: object.height
                    };
                    if (object.imageSrcUrl.length > 0) {
                        numberOfImages++;
                    }
                    if (object.text) {
                        data.aiData = JSON.parse(object.text);
                    }
                    _log('getDataOfPage::photo object, data =>', object, data);
                }
                if (object.dataType == NPDataType.drawing) {
                    data.drawingUrl = object.imageSrcUrl;
                    data.thumbImageUrl = this._getThumbImageUrl(object.imageSrcUrl, object.thumbImageUrl);
                    data.thumbImageUrlDark = this._getThumbImageUrlDark(object.imageSrcUrl, object.thumbImageUrl, object.thumbImageUrlDark);
                    data.isHoriOfthumbImage = this._isHoriOfImageObject(object);
                    data.thumbViewBox = {
                        left: object.left,
                        top: object.top,
                        width: object.width,
                        height: object.height
                    };
                    if (object.imageSrcUrl.length > 0) {
                        numberOfImages++;
                    }
                    if (object.text) {
                        data.aiData = JSON.parse(object.text);
                    }
                }

            }
            // objects에 모든 스티커 중에서 tag가 있는 스티커만 전달
            if (object.type == fabricObjectType.stickerGroupInputBox) {
                if (object.objects && object.objects.length > 0) {
                    let images = object.objects.filter((obj: any) => (obj.type == 'image' && obj._key));
                    if (images.length > 0) {
                        if (!data.stickerUrls) { data.stickerUrls = []; }
                        for (let image of images) {
                            if (image.src) {
                                data.stickerUrls.push(image.src);
                            }
                        }
                    }
                }
            }

            // 페이지에 추가된 파일의 개수
            if (object.type == fabricObjectType.image && object.src && object.src.length > 0) {
                if (object.extType == 'sticker') {
                    // 첨부된 스티커는 부가요소로 리스트에 표시 안하기로 함 
                    // if(!data.stickerUrls) { data.stickerUrls = []; }
                    // data.stickerUrls.push(object.src);
                } else {
                    // 정식 사진 데이타가 없을 경우 첨부된 사진 데이타도 photoUrl에 포함한다.
                    if (!data.photoUrl || data.photoUrl.length == 0) {
                        data.photoUrl = object.src;
                        // object에 첨부한 image는 datatype보다 우선 순위가 낮다.
                        if (!data.thumbImageUrl) {
                            data.thumbImageUrl = object.thumbImageUrl? object.thumbImageUrl : object.src;
                            data.isHoriOfthumbImage = this._isHoriOfImageObject(object);
                        }
                        if (!data.thumbImageUrlDark) {
                            data.thumbImageUrlDark = object.thumbImageUrlDark? object.thumbImageUrlDark : data.thumbImageUrl;
                        }
                        numberOfImages++;
                        // thumb Image 후순위
                        // if (!data.thumbImageUrl || data.thumbImageUrl.length == 0) {
                        //     data.thumbImageUrl = object.text? object.text : object.src; // text 필드를 이용한다.
                        // }
                    }
                }
            }
        }

        // 이미지수
        data.numberOfImages = numberOfImages;

        // object에서 date를 찾을 수 없고 page에는 있다면, 그림만 있는 object
        if (!data.date && page.date) {
            data.date = page.date;
        }

        _log('getDataOfPage page, data =>', page, data);
        return data as NPPageData;
    }

    private _getMediaOfObject(object: any, date: string = ''): NPMediaData {
        //_log('getMediaOfObject object =>', object);
        let data: NPMediaData = { type: NPMediaType.photo, src: '', thumbImageUrl: '', thumbImageUrlDark: '', date: '', pageKey: '', noteContentKey: '', width: 0, height: 0 };
        data.date = date ? date : '';
        if (object.type == fabricObjectType.imageInputBox) {
            _log('getMediaOfObject object =>', object);
            data.src = object.imageSrcUrl
            data.thumbImageUrl = object.thumbImageUrl? object.thumbImageUrl : object.imageSrcUrl;
            data.thumbImageUrlDark = object.thumbImageUrlDark? object.thumbImageUrlDark : data.thumbImageUrl;
            data.type = NPMediaType.photo;
            if (object.objects && object.objects.length > 0) {
                let imageObjects = object.objects.filter((obj: any) => (obj.type == 'image' && obj._key));
                if (imageObjects.length == 1) {
                    data.width = imageObjects[0].width;
                    data.height = imageObjects[0].height;
                    _log('getMediaOfObject imageObjects, width, height =>', imageObjects[0], data.width, data.height);
                }
            }
        } else if (object.type == fabricObjectType.drawingInputBox) {
            data.src = object.imageSrcUrl
            data.thumbImageUrl = this._getThumbImageUrl(object.imageSrcUrl, object.thumbImageUrl);
            data.thumbImageUrlDark = this._getThumbImageUrlDark(object.imageSrcUrl, object.thumbImageUrl, object.thumbImageUrlDark);
            data.type = NPMediaType.drawing;
            data.width = object.width;
            data.height = object.height;
        } else if (object.type == fabricObjectType.image && object.src && object.src.length > 0 && object.extType !== 'sticker') {
            data.src = object.src;
            data.thumbImageUrl = object.thumbImageUrl? object.thumbImageUrl : object.src;
            data.thumbImageUrlDark = object.thumbImageUrlDark? object.thumbImageUrlDark : data.thumbImageUrl;
            data.type = NPMediaType.photo;
            data.width = object.width;
            data.height = object.height;
        }
        return data;
    }

    private _isHoriOfImageObject(object: any): boolean {
        let media = this._getMediaOfObject(object);
        let isHori: boolean = true;
        try {
            isHori = media.width >= media.height
        } catch (e: any) {
            isHori = true;
        }
        return isHori;
    }

    // page안에 objects가 없으면 로딩, 아니면 그냥 데이타 추출
    async getDataOfPage(page: NPPage, userId: string): Promise<NPPageData> {
        // load object
        if (!page.objects || page.objects.length == 0) {
            try {
                _log('getDataOfPage noteContentKey, page._key,  userId, page.objects =>', page.noteContentKey, page._key, userId, page.objects);
                page.objects = await this.getNotePageObjects(page.noteContentKey, page._key, userId);
            } catch (e) {
                throw new Error();
            }
        }

        let data: NPPageData = this._getDataOfPage(page);
        return data as NPPageData;
    }

    //  전체보기에서만 사용함
    async getLoadedPagesOrderByDate(noteContent: NPNoteContent, userId: string, isCopyArray: boolean = true) {
        let pages: Array<NPPage> = isCopyArray ? noteContent.pages.slice() : noteContent.pages;

        for (let page of pages) {
            if (!page.objects || page.objects.length == 0) {
                try {
                    _log('getPagesOrderByDate noteContent._key, page._key,  userId, page.objects =>', noteContent._key, page._key, userId, page.objects);
                    page.objects = await this.getNotePageObjects(noteContent._key, page._key, userId);
                } catch (e) {
                    throw new Error();
                }
            }
        }
        pages = this.getPagesOrderByDate(pages, false);
        return pages;
    }

    getPagesOrderByDate(pages: Array<NPPage>, isCopyArray: boolean = true) {
        let _pages = isCopyArray ? pages.slice() : pages;
        _pages.sort((pageA: NPPage, pageB: NPPage) => {
            if (!pageA.date && !pageB.date) return 0; // 둘 다 date가 없으면 순서 유지
            if (!pageA.date) return -1; // a의 date가 없으면 a가 앞쪽으로
            if (!pageB.date) return 1; // b의 date가 없으면 b가 뒤쪽으로

            let result = 0;
            try {
                const dateA = new Date(pageA.date).getTime();
                const dateB = new Date(pageB.date).getTime();
                result = dateA - dateB;
                //_log('getPagesOrderByDate::sort dateA, dataB, result =>', dateA, dateB, result);

                // If dates are equal, sort by updateDate
                if (result === 0 && pageA.registDate && pageB.registDate) {
                    const registDateA = new Date(pageA.registDate).getTime();
                    const registDateB = new Date(pageB.registDate).getTime();
                    result = registDateA - registDateB;
                    //_log('getPagesOrderByDate::sort registDateA, registDateB, result =>', dateA, dateB, result);
                }
            } catch {
                _log('getPagesOrderByDate::sort fail')
                result = 0;
            }
            return result;
        });
        return _pages;
    }

    // getPagesOrderByDate(pages: Array<NPPage>, isCopyArray: boolean = true) {
    //     let _pages = isCopyArray ? pages.slice() : pages;
    //     _pages.sort((pageA: NPPage, pageB: NPPage) => {
    //         // let dataA = this._getDataOfPage(itemA);
    //         // let dataB = this._getDataOfPage(itemB);
    //         // _valid(dataA && dataB && dataA.date && dataB.date);
    //         // if (!(dataA && dataB && dataA.date && dataB.date)) { 
    //         //     _log('getPagesOrderByDate fail itemA, itemB =>', itemA, itemB);
    //         //     return 0 
    //         // }
    //         let result = 0;
    //         if (!pageA.date || !pageB.date) { return 0; }
    //         try {
    //             result = new Date(pageA.date).getTime() - new Date(pageB.date).getTime();
    //         } catch {
    //             result = 0;
    //         }
    //         return result;
    //     })
    //     return _pages;
    // }



    // 일기 쓸때 페이지의 위치를 date를 기반으로 찾는 함수
    // 문제는 모든 페이지의 objects가 있어야 함. 지연로딩에는 문제가 됨 
    // getPageNumberByDate(noteContent: NPNoteContent, date: Date) {
    //     _log('getPageNumberByDate noteContent.pages, date =>', noteContent.pages, date);
    //     let pageNumber = 0;
    //     for(let page of noteContent.pages) {
    //         let pageData = this.getDataOfPage(page);
    //         _log('getPageNumberByDate pageData, pageNumber =>', pageData, pageNumber);
    //         if (pageData.date) {
    //             let pageDate = new Date(pageData.date);
    //             if (pageDate > date) { break; }
    //         }
    //         pageNumber++;
    //     }
    //     _log('getPageNumberByDate pageNumber =>', pageNumber);
    //     return pageNumber;
    // }

    // 일기 쓸때 페이지의 위치를 date를 기반으로 찾는 함수
    // 문제는 모든 페이지의 objects가 있어야 함. 지연로딩에는 문제가 됨 
    async getPageNumberByDate(noteContent: NPNoteContent, date: Date, userId: string) {
        _log('getPageNumberByDate noteContent.pages, date =>', noteContent.pages, date);
        let pageNumber = noteContent.pages.length;
        for (let page of noteContent.pages.slice().reverse()) {
            let pageData = await this.getDataOfPage(page, userId);
            _log('getPageNumberByDate pageData, pageNumber =>', pageData, pageNumber);
            if (pageData.date) {
                let _pageDate = new Date(pageData.date);
                if (_pageDate <= date) { break; }
            }
            pageNumber--;
        }
        _log('getPageNumberByDate pageNumber =>', pageNumber);
        return pageNumber;
    }

    /* -------------------------------------------------------------------------- */
    // #getTemplate
    // 받은템플릿으로 noteContent.templates에서 id로 찾는데 같은경우 version이 높은것을 return한다. 
    _getNoteTemplateByOriTemplate(noteContent: NPNoteContent, oriTemplate: NPPageTemplate) {
        _flog(this._getNoteTemplateByOriTemplate, arguments);
        _valid(oriTemplate.id);
       return this._getLatestPageTemplateByTemplateId(noteContent, oriTemplate.id, oriTemplate.updateDate);
    }

    // 최신버전의 템플릿을 얻는다. 만약 templateVersion버전보다 이전이면 undefined를 return한다.
    // ** 원래는 version으로 체크를 했는데 최신 버전이 4인데 2를 넣게 되면서 문제가 생김
    // 최신 버전을 알기가 어려워서 발생
    _getLatestPageTemplateByTemplateId(noteContent: NPNoteContent, templateId: string, oriUpdateDate?: string): NPPageTemplate | undefined {
        _flog(this._getLatestPageTemplateByTemplateId, arguments);
        let copiedTemplate: NPPageTemplate | undefined;
        _valid(templateId && templateId.length > 0);
        if (!noteContent.templates || noteContent.templates.length == 0) { return copiedTemplate; }

        // 사용된 템플릿에서 id가 같은 것을 찾음
        const matchedTemplates = noteContent.templates.filter(item => {
            _valid(item.id && item.id.length > 0);
            return item.id === templateId;
        });
        _log('_getNoteTemplateByOriTemplate =>', matchedTemplates);
        
        // 그중에 updateDate가 가장 최신인 것을 찾음
        if (matchedTemplates.length > 0) {
            copiedTemplate = matchedTemplates.reduce((latest, item) => 
                new Date(item.updateDate ?? 0) > new Date(latest.updateDate ?? 0) ? item : latest
            );
        }
        _log('_getNoteTemplateByOriTemplate1 copiedTemplate =>', copiedTemplate);

        // 찾은 최신버전하고 oriTemplate비교 // 지금께 더 최신이면 unfined를 주고 oriTemplate를 새로 복사함
        if (copiedTemplate && new Date(oriUpdateDate ?? 0) > new Date(copiedTemplate.updateDate ?? 0)) {
            _log('_getNoteTemplateByOriTemplate copiedTemplate, templateId =>', copiedTemplate, templateId);
            return undefined;
        }        
        _log('_getNoteTemplateByOriTemplate2 copiedTemplate =>', copiedTemplate);
        return copiedTemplate;
    }

    // #getTemplate
    async getPageTemplateByPageAndRepairAsync(noteContent: NPNoteContent, page: NPPage): Promise <{ pageTemplate: NPPageTemplate | undefined, isRepaired: boolean}> {
        _valid(noteContent);
        _valid(page);
        let _template: NPPageTemplate | undefined = this.getPageTemplateInNoteContentByTemplateKey(noteContent, page.templateKey);
        _valid(_template);
        let isRepaired: boolean = false;
        // 이 노트에 사용한 템플릿 중에서 이 페이지 템플릿을 못 찾을 때 
        if (!_template) {  
            _valid(page.templateId);
            if (page.templateId) {
                _template = this._getLatestPageTemplateByTemplateId(noteContent, page.templateId);
                if (_template) {
                    _log('noteapi::template::repair page, _template =>', page, _template);
                    page.templateKey = _template._key // 이 작업을 하고 저장해줘야 assert가 더이상 발생하지 않는다.
                    isRepaired = true;
                    await this.updatePage(noteContent._key, page);
                }
            }
        }
        _log('getPageTemplateInNoteContent _template =>', _template);   
        return { pageTemplate: _template, isRepaired: isRepaired };
    }

    getPageTemplateInNoteContentByTemplateKey(noteContent: NPNoteContent, templateKey: string) {
        _log('getPageTemplateInNoteContentByTemplateKey noteContent, templateKey =>', noteContent, templateKey);
        _valid(noteContent);
        _valid(templateKey);
        let pageTemplate: NPPageTemplate | undefined = noteContent.templates.find((template) => template._key == templateKey);
        _valid(pageTemplate);
        return pageTemplate;
    }

    /* -------------------------------------------------------------------------- */

    // 같은 노트에서 추가를 전제로 한다. 다른 노트 복사를 위해서는 noteContent가 src, target둘다 필요함
    async addPageInNoteContentAtPositionWithPage(note: NPNote, noteContent: NPNoteContent, page: NPPage, userId: string, Position?: number) {
        _valid(page);

        // add template : 중복 제외 : 이 부분은 필요 없어 보이는데 .. 삭제는 안함
        // let _template: NPPageTemplate | undefined = this.getPageTemplateInNoteContentByTemplateKey(noteContent, page.templateKey);
        // _log('addPageInNoteContentAtPageNumberWithPage page, _template =>', page, _template);
        // _valid(_template);
        // if (!_template) { return; }
        // _log('addPageInNoteContentAtPageNumberWithPage noteContent.pages, pageNumber =>', noteContent.pages, pageNumber);

        //db에 저장
        this.insertPage(note, noteContent, page, userId, Position);
        return noteContent;
    }



    
    // 템플릿 가지고 새로운 페이지를 만들 때 
    // template 여기 템플릿은 복사하기전 원본 템플릿임
    async addPageWithOriPageTemplate(note: NPNote, noteContent: NPNoteContent, oriTemplate: NPPageTemplate, userId: string, pageBgColor: string,
        position: number = 1, date?: Date) {
        _flog(this.addPageWithOriPageTemplate, arguments);

        // 템플릿에 object정보가 없으면 모두 포함된 값으로 다시 가져온다.
        if (!oriTemplate.objects) {
            let template = await this.getPageTemplate(oriTemplate._key);   // 노트에서 가져와야 하는데
            if (!template) { throw Error(NPError.unknown); }
            oriTemplate = template;
        }

        ////////////////////////////////////////////////////////////////////////////////
        // !! id를 기준으로 템플릿을 찾고 있음, 상품을 업데이트해도 이전 상품이 나오게 됨 
        // 기존에 복사된 노트에서 템플릿 찾기        
        let copiedTemplate: NPPageTemplate | undefined = this._getNoteTemplateByOriTemplate(noteContent, oriTemplate);

        // 기존 노트에서 사용한 템플릿이 아니라 새로운 템플릿이면 복사함
        _log('addPageInNewNoteWithOriPageTemplat copiedtemplate =>', copiedTemplate);
        if (!copiedTemplate) {
            copiedTemplate = await this.copyItem(oriTemplate, userId);
            if (copiedTemplate) {
                _log('addPageInNoteContentAtPosition copiedtemplate =>', copiedTemplate);
                noteContent.templates.push(copiedTemplate);
            } else {
                throw new Error(NPError.unknown);
            }

            // 템플릿이 새로 추가 된 경우만 저장한다.
            // 여기서 템플릿 저장 - 값이 바뀌는 것을 방지하기 위해 복사해서 저장한다. 
            let tempates = CFHelper.json.deepClone(noteContent.templates);
            for (let _template of tempates) {
                let index = 0;
                if (_template.objects) {
                    for (let object of _template.objects) {
                        _template.objects[index] = this.api._docToSaveDoc(object, true);
                        index++;
                    }
                }
            }
            // template를 저장해야 함 
            await this.api.update('NPNoteContent', noteContent._key, { templates: tempates });
        }
        _log('addPageInNewNoteWithOriPageTemplat noteContent.pages, position =>', noteContent.pages, position);

        //////////////////////////////////////////////////////////////////
        // 기본 페이지 하나 만들고 object넣어서 페이지 하나 만듦
        //let objs = CFHelper.json.deepClone(objects);
        //let isPublic = note.isPublic ? note.isPublic : false;
        let page: NPPage = new NPPage(copiedTemplate._key, copiedTemplate.id, [], userId, pageBgColor, '', false, noteContent._key);
        // 페이지 만들때 날짜를 추가로 저장함
        if (date) {
            page.date = date.toISOString();
        }
        _log('addPageWithOriPageTemplate page, note =>', page, note);
        _log('addPageWithOriPageTemplate noteContent.pages, position =>', noteContent.pages, position);
        this.insertPage(note, noteContent, page, userId, position); // note는 udpateDate 갱신을 위해 넣어줌
        return [noteContent, page];
    }

    // 기존에 있던 템플릿으로 페이지 추가 하기 
    // grid view에서 현재 선택된 페이지의 template을 얻어서 position과 함께 보내서 추가 함 
    // async addPageWithOtherTemplate(noteContent: NPNoteContent, templateOfPage: NPPageTemplate, userId:string, pageBgColor: string, position: number = 1) {
    //     _flog(this.addPageWithOtherTemplate, arguments);

    //     // 템플릿에 object정보가 없으면 모두 포함된 값으로 다시 가져온다.
    //     if (!templateOfPage.objects) { throw Error(NPError.unknown); }

    //     let page:NPPage = new NPPage(templateOfPage._key, [], userId, pageBgColor);
    //     _log('addPageWithOtherTemplate noteContent.pages, position =>', noteContent.pages, position);
    //     this.insertPage(noteContent, page, userId, position);
    //     return [noteContent, page];
    // }

    // private _addPreviewCacheSvgField(noteContent: NPNoteContent, ) {
    //     let _noteContent = CFHelper.json.deepClone(noteContent);
    //     for(let page of _noteContent.pages) {
    //         delete page.previewCacheSvg;
    //     }
    //     return _noteContent;
    // }

    // private _removePreviewCacheSvgField(noteContent: NPNoteContent) {
    //     // previewCacheSvg 제거
    //     let _noteContent = CFHelper.json.deepClone(noteContent);
    //     for(let page of _noteContent.pages) {
    //         delete page.previewCacheSvg;
    //     }
    //     return _noteContent;
    // }

    // async addPageInNewNoteWithOriPageTemplat(noteContent: NPNoteContent, oriTemplate: NPPageTemplate, userId:string, pageBgColor: string, objects: Array<any> = []) {
    //     _flog(this.addPageInNoteContentAtPageNumber, arguments);
    //     // 템플릿에 object정보가 없으면 모두 포함된 값으로 다시 가져온다.
    //     if (!oriTemplate.objects) {
    //         let template = await this.getPageTemplate(oriTemplate._key);   // 노트에서 가져와야 하는데
    //         if (!template) {  throw Error(NPError.unknown); }
    //         oriTemplate = template;
    //     }

    //     // add template : 중복 제외
    //     let copiedTemplate: NPPageTemplate | undefined;
    //     _valid(oriTemplate.id && oriTemplate.id.length > 0);
    //     if (noteContent.templates && noteContent.templates.length > 0) {
    //         copiedTemplate = noteContent.templates.find(item => {
    //             _valid(item.id && item.id.length > 0);
    //             return item.id == oriTemplate.id
    //         });
    //     }

    //     // 템플릿 복사해서 템플릿 추가
    //     _log('addPageInNoteContentAtPageNumber copiedtemplate =>', copiedTemplate);
    //     if (!copiedTemplate) {
    //         copiedTemplate = await this.copyItem(oriTemplate, userId);
    //         if (copiedTemplate) {
    //             _log('addPageInNoteContentAtPageNumber copiedtemplate =>', copiedTemplate);
    //             noteContent.templates.push(copiedTemplate);          
    //         } else {
    //             throw new Error(NPError.unknown);
    //         }

    //         // 템플릿이 새로 추가 된 경우만 저장한다.
    //         // 여기서 템플릿 저장 - 값이 바뀌는 것을 방지하기 위해 복사해서 저장한다. 
    //         let tempates = CFHelper.json.deepClone(noteContent.templates);
    //         for(let _template of tempates) {
    //             let index = 0;
    //             if (_template.objects) {
    //                 for(let object of _template.objects) {
    //                     _template.objects[index] = this.api._docToSaveDoc(object, true);
    //                     index++;
    //                 }
    //             }
    //         }
    //         // template를 저장해야 함 
    //         await this.api.update('NPNoteContent', noteContent._key, { templates: tempates}); 
    //     }
    //     _log('addPageInNoteContentAtPageNumber noteContent.pages, pageNumber =>', noteContent.pages, pageNumber);

    //     //////////////////////////////////////////////////////////////////
    //     // 기본 페이지 하나 만들고 object넣어서 페이지 하나 만듦
    //     let objs = CFHelper.json.deepClone(objects);
    //     let page:NPPage = new NPPage(copiedTemplate._key, objs, userId, pageBgColor);
    //     _log('addPageInNoteContentAtPageNumber2 noteContent.pages, pageNumber =>', noteContent.pages, pageNumber);
    //     this.insertPage(noteContent, page, userId, pageNumber);
    //     return [noteContent, page]
    // }

    // 언두/리두 => 같은 키, 클립보드 => 다른키
    clonePage(page: NPPage, isSameKey: boolean = true) {
        if (!page.objects) {
            page.objects = [];
        }
        let objs = CFHelper.json.deepClone(page.objects);
        let _page = new NPPage(page.templateKey, page.templateId, objs, page.userId, page.backgroundColor,
            page.previewCacheSvg, page.isPublic, page.noteContentKey);
        if (isSameKey) {
            _page._key = page._key;
        }
        return _page;
    }

    // db에 저장하는게 아니라 메모리 상에서 page하나 복제함 
    // copyPage, 페이지 복제 할 떄 사용함
    clonePageInNoteContent(noteContent: NPNoteContent, pageForCopy: NPPage, userId: string) {
        _log('clonePageInNoteContent noteContent, pageNum =>', noteContent, pageForCopy);
        _valid(noteContent);
        // _valid(pageNum > 0);
        // _valid(pageNum <= noteContent.pages.length);

        //let pageForCopy: NPPage = noteContent.pages[pageNum-1];
        _log('clonePageInNoteContent pageForCopy =>', pageForCopy);
        let objs = CFHelper.json.deepClone(pageForCopy.objects);
        _log('clonePageInNoteContent objs =>', objs);

        // 복사한 페이지는 공개를 false로 한다.
        let page: NPPage = new NPPage(pageForCopy.templateKey, pageForCopy.templateId, objs, userId, pageForCopy.backgroundColor,
            pageForCopy.previewCacheSvg, false, pageForCopy.noteContentKey);
        return page; //this.clonePage(pageForCopy);
    }

    async duplicatePageInNoteContent(note: NPNote, noteContent: NPNoteContent, pageForCopy: NPPage, atPagePosition: number, userId: string) {
        _flog(this.duplicatePageInNoteContent, arguments);
        let page: NPPage = this.clonePageInNoteContent(noteContent, pageForCopy, userId);

        // save 
        await this.insertPage(note, noteContent, page, userId, atPagePosition);
        _log('duplicatePageInNoteContent noteContent =>', noteContent);

        return [noteContent, page];
    }

    async removePageInNoteContent(note: NPNote, noteContent: NPNoteContent, pageNumber: number) {
        _log('removePageInNoteContent noteContent, pageNum =>', noteContent, pageNumber);
        _valid(noteContent);
        _valid(pageNumber > 0);
        _valid(pageNumber <= noteContent.pages.length);

        let pageForRemove: NPPage = noteContent.pages[pageNumber - 1];

        // remove
        noteContent.pages.splice(pageNumber - 1, 1);
        _log('removePageInNoteContent pageForRemove =>', pageForRemove);

        // 템플릿 삭제 : 노트 편집중에 페이지 삭제 했다고 템플릿 지우면 undo시 템플릿을 찾을 수 없게 됨, 일단 삭제를 보류 하고 나중에 노트 오픈 시 삭제 한다.
        // 우선 pages에서 같은 템플릿을 찾는다.
        // let _template = noteContent.pages.find(_page => _page.templateKey == pageForRemove.templateKey);
        // _log('removePageInNoteContent _template =>', _template);

        // // 이 페이지만 쓴다면 삭제 대상
        // if (!_template) { 
        //     if (noteContent.templates && noteContent.templates.length > 0) {
        //         let _indexForRemove = noteContent.templates.findIndex(_template => _template._key == pageForRemove.templateKey);
        //         _valid(_indexForRemove !== -1);
        //         noteContent.templates.splice(_indexForRemove, 1);
        //     }
        // }

        let page: NPPage = await this.api.getByPath(`NPNoteContent/${noteContent._key}/pages/${pageForRemove._key}`, false, false);
        if (page) {
            // db에 저장 
            await this.api.delete(`NPNoteContent/${noteContent._key}/pages`, pageForRemove._key); //
            //await this._setNoteContent(noteContent); 
        } else {
            //_valid(false);
        }
        _log('removePageInNoteContent2 noteContent, pageNum =>', noteContent);

        // update date
        if (note) { this.updateUpdateDateOfNote(note); }
        if (page) { this.updateUpdateDateOfPage(noteContent, page); }

        return noteContent;
    }

    // async getNoteContent(note: NPNote/*, order: NPOrderType = NPOrderType.asc*/) {
    //     _log('getPage note =>', note);
    //     // get NoteContent
    //     let noteContent: NPNoteContent = await this.api.get('NPNoteContent', note.contentKey);

    //     // get NoteContent/pages
    //     noteContent.pages = await this.api.getCollection(`NPNoteContent/${noteContent._key}/pages`);

    //     // get NoteContent/pages/objects
    //     let index = 0;
    //     for(let page of noteContent.pages) {
    //         page.objects = await this.api.getCollection(`NPNoteContent/${noteContent._key}/pages/${index}/objects`);
    //         index++;
    //     }
    //     _log('getPage2 noteContent =>', noteContent);
    //     return _valid(noteContent);
    // }


    // #pages
    // async updatePages(note: NPNote, noteContent: NPNoteContent, pages: Array<NPPage>) {
    //     _valid(noteContent);

    //     let _pages = CFHelper.json.deepClone(pages);
    //     for(let page of _pages) {
    //         page.objects = []; 
    //     }      
    //     _log('updatePages note, noteContent, _pages =>', note, noteContent, _pages);
    //     // update pages
    //     let notePages = await this.api.setCollection(`NPNoteContent/${noteContent._key}/pages`, _pages);
    //     if (!notePages) { 
    //         throw new Error();
    //     }

    //     // update pages/objects
    //     let _pages2 = CFHelper.json.deepClone(pages);
    //     let index = 0;
    //     for(let page of _pages2) {
    //         // #search
    //         await this._setObjectsTextForSearch(page.objects, `NPNoteContent/${noteContent._key}/pages/${index}/objects`, this.loginedUserId);
    //         await this.api.setCollection(`NPNoteContent/${noteContent._key}/pages/${index}/objects`, page.objects, true, ['text'], this.loginedUserId);
    //         index++;
    //     }

    //     noteContent.pages = pages as Array<NPPage>;
    //     await this.updateUpdateDateOfNote(note);
    //     return noteContent;
    // }

    // async _setNoteContent(noteContent: NPNoteContent) {
    //     // 저장하기 위해서 previewCacheSvgField를 제거한다.
    //     let _noteContent = this._removePreviewCacheSvgField(noteContent);

    //     // create NoteContent/pages/objects
    //     let index = 0;
    //     for(let page of _noteContent.1pages) {
    //         await this.api.setCollection(`NPNoteContent/${_noteContent._key}/pages/${index}/objects`, page.objects);
    //         index++;
    //         delete page.objects;
    //     }
    //     // create NoteContent/pages
    //     await this.api.setCollection(`NPNoteContent/${_noteContent._key}/pages`, _noteContent.pages);
    //     // create NoteContent
    //     delete _noteContent.pages;
    //     await this.api.set('NPNoteContent', _noteContent._key, _noteContent);    
    // }

    // async _setNoteContent(noteContent: NPNoteContent) {
    //     // 저장하기 위해서 previewCacheSvgField를 제거한다.
    //     let _noteContent = this._removePreviewCacheSvgField(noteContent);

    //     // create NoteContent/templates/objects
    //     for(let template of _noteContent.templates) {
    //         let index = 0;
    //         if (template.objects) {
    //             for(let object of template.objects) {
    //                 template.objects[index] = this.api._docToSaveDoc(object, true);
    //                 index++;
    //             }
    //         }
    //         _log('_setNoteContent noteContent =>', _noteContent);
    //     }

    //     // create NoteContent/pages/objects
    //     let index = 0;
    //     for(let page of _noteContent.pages) {
    //         // #search
    //         await this._setObjectsTextForSearch(page.objects, `NPNoteContent/${_noteContent._key}/pages/${index}/objects`, this.loginedUserId);
    //         let list = await this.api.setCollection(`NPNoteContent/${_noteContent._key}/pages/${index}/objects`, page.objects, true, ['text'], this.loginedUserId);
    //         index++;
    //         delete page.objects;
    //     }

    //     // create NoteContent/pages
    //     await this.api.setCollection(`NPNoteContent/${_noteContent._key}/pages`, _noteContent.pages);
    //     delete _noteContent.pages;

    //     // create NoteContent
    //     _log('_setNoteContent _noteContent =>', _noteContent);
    //     await this.api.set('NPNoteContent', _noteContent._key, _noteContent);    // templates/0/objects/0,1
    // }

    // async listNoteContent(notes: Array<NPNote>) {
    //     let keys = [];
    //     for(let note of notes) {
    //         keys.push(note.contentKey);
    //     }
    //     return await this.api.listByKeys('NPNoteContent', keys);
    // }

    async insertPage(note: NPNote | null, noteContent: NPNoteContent, page: NPPage, userId: string, atPosition?: number): Promise<NPNoteContent> {
        _valid(noteContent);
        _valid(userId);

        // page
        _log('insertPage noteContent, page, seq =>', noteContent.pages, atPosition);
        let seq: string = this.makeSeq(noteContent.pages, atPosition);
        page.seq = seq;
        _log('insertPage noteContent, page, seq =>', noteContent, page, seq);
        // data 변경
        if (atPosition !== undefined) {
            _valid(atPosition >= 0, `atIndex = ${atPosition}`);
            noteContent.pages.splice(atPosition, 0, page);
        } else {
            noteContent.pages.push(page);
        }



        // 저장 할 page의 key를 구하고
        // let pageNumber = noteContent.pages.findIndex(_page => _page._key == page._key) + 1;
        // if (pageNumber < 1) { return noteContent; }

        // _valid(pageNumber > 0);
        // _valid(pageNumber <= noteContent.pages.length);
        // if (!noteContent.pages[pageNumber-1]) { 
        //     _log('updatePage 저장하려고 하는데 저장할 페이지가 없는 경우 : 이미 삭제되었을 수 있음');
        //     return noteContent;
        // } 
        let _copiedPage = CFHelper.json.deepClone(page);
        _copiedPage.objects = [];

        // db저장 : objects에 2중 array때문에 create에서 오류나기 때문에 복사해서 objects날라고 생성한다.
        let _page = await this.api.create(`NPNoteContent/${noteContent._key}/pages`, _copiedPage, _copiedPage._key); // _key가 바뀜
        // pags/objects
        await this._setObjectsTextForSearch(page.objects, `NPNoteContent/${noteContent._key}/pages/${_page._key}/objects`, userId);

        let _objects: any = await this.api.setCollection(`NPNoteContent/${noteContent._key}/pages/${_page._key}/objects`, page.objects, true,
            ['text'], true, userId);
        if (!_objects) {
            throw new Error();
        }
        _valid(_objects);

        // update date
        if (note) { this.updateUpdateDateOfNote(note); }
        if (page) { this.updateUpdateDateOfPage(noteContent, page); }

        return noteContent;
    }

    async repositionPage(note: NPNote, noteContent: NPNoteContent, page: NPPage, atIndex: number, isAlreadyAddedData: boolean = false) {
        _log('repositionPage noteContent, page, atIndex =>', noteContent, page, atIndex); // 0~
        _valid(noteContent);

        // 받은 page가 noteContent의 instance인지 모르니까 가져옴
        let __page: NPPage | undefined = noteContent.pages.find((_page) => _page._key == page._key);
        _valid(__page)
        if (!__page) return noteContent.pages;

        // page
        let seq: string = this.makeSeq(noteContent.pages, atIndex, isAlreadyAddedData); // noteContent.pages 의 data가 이미 바뀌었음
        __page.seq = seq;
        await this.api.update(`NPNoteContent/${noteContent._key}/pages`, __page._key, { seq: seq });
        await this.updateUpdateDateOfNote(note);
        return noteContent.pages = noteContent.pages.sort((a: any, b: any) => a.seq.localeCompare(b.seq));
    }

    // isAlreadyAddedData 넣을 곳의 앞/ 뒤 seq를 얻으려고 하는데 이미 데이타가 들어간 경우 next값은 +1 해야 함
    makeSeq(list: Array<any>, position?: number, isAlreadyAddedData: boolean = false) {
        _log('makeSeq list, position =>', list, position);
        let seq: string = '';
        let prev: string = '';
        let next: string = '';
        if (list.length == 0) { return '1'; }
        if (position === undefined) {
            prev = list[list.length - 1].seq;
        } else {
            prev = list[position - 1] ? list[position - 1].seq : '';
            if (isAlreadyAddedData) {
                next = list[position + 1] ? list[position + 1].seq : '';
            } else {
                next = list[position] ? list[position].seq : '';
            }
        }
        _log('makeSeq prev, next =>', prev, next);
        if (prev.length == 0 && next.length == 0) { return '1'; }
        if (prev.length == 0) {
            seq = '0' + next;   // 앞으로 추가
        } else {
            seq = this._getNextSeqValue(prev, next);    // 뒤로 추가
        }
        _log('makeSeq seq =>', seq);
        return seq;
    }

    _getNextSeqValue(prev: string, next?: string) {
        let length = 1000;
        let seq = '';
        _log('_getNextSeqValue prev, next =>', prev, next);
        for (let i = 0; i < length; i++) {
            let p = i < prev.length ? parseInt(prev.charAt(i)) : 0;
            let n = next && i < next.length ? parseInt(next.charAt(i)) : 10;
            let s = p + 1;
            _log('makeSeq s, p, n, prev, next =>', s, p, n, prev, next);
            if (s < n) {
                // 조건 만족 
                seq += s;
                _log('makeSeq complete seq =>', seq);
                break;
            }
            // 조건 불만족 - 현재값을 담고 다음자리수로 이동
            seq += p;
            _log('makeSeq next i, seq =>', i, seq);
        }
        return seq;
    }

    // 이 작업에 대한 cache
    // async updatePage(note: NPNote, noteContent: NPNoteContent,  page: NPPage): Promise<NPNoteContent> {
    //     _log('updatePage noteContent, page =>', noteContent, page);
    //     _valid(noteContent);

    //     let _page = this.getPageFromNoteContent(noteContent, page._key);
    //     _valid(_page);
    //     if (!_page) return noteContent; 
    //     // 저장 할 page의 key를 구하고
    //     // let pageNumber = noteContent.pages.findIndex(_page => _page._key == page._key) + 1;
    //     // if (pageNumber < 1) { return noteContent; }

    //     // _valid(pageNumber > 0);
    //     // _valid(pageNumber <= noteContent.pages.length);
    //     // if (!noteContent.pages[pageNumber-1]) { 
    //     //     _log('updatePage 저장하려고 하는데 저장할 페이지가 없는 경우 : 이미 삭제되었을 수 있음');
    //     //     return noteContent;
    //     // } 

    //     await this._setObjectsTextForSearch(page.objects, `NPNoteContent/${noteContent._key}/pages/${page._key}/objects`, this.loginedUserId);
    //     let _objects: any = await this.api.setCollection(`NPNoteContent/${noteContent._key}/pages/${page._key}/objects`, page.objects, true, ['text'], this.loginedUserId);
    //     if (!_objects) { 
    //         throw new Error();
    //     }
    //     _valid(_objects);
    //     await this.updateUpdateDateOfNote(note);
    //     return noteContent;
    // }



    // async getPageNumberByPageKey(note: NPNote, pageKey: string, userId: string) {
    //     let noteContent = await this.getNoteContent(note.contentKey, userId);
    //     let idx = 0;
    //     let pageIndex = noteContent.pages.findIndex((_page: NPPage) => _page._key == pageKey);
    //     _valid(pageIndex > -1);
    //     _log('getPageNumberByObjectKey noteContent, pageKey, pageIndex =>', noteContent, pageKey, pageIndex);        
    //     return pageIndex > -1? pageIndex + 1: 1;
    // }

    // #object
    async updatePageObject(note: NPNote, noteContent: NPNoteContent, _params: any, userId: string): Promise<NPNoteContent> {
        let params: IUpdateObjectParams = _params as IUpdateObjectParams;
        _log('updatePageObject action, noteContent, pageKey, object =>',
            params.action, noteContent, params.pageKey, params.object);

        _valid(noteContent);
        let pageKey = params.pageKey;
        let object = params.object;
        let action = params.action;     // update, insert, delete

        let page = this.getPageFromNoteContent(noteContent, pageKey);
        _valid(page);
        if (!page) { return noteContent; }

        // object path
        if (!object._key || object._key.length == 0) {
            object._key = CFHelper.id.generateUUID();
        }

        let objPath = `NPNoteContent/${noteContent._key}/pages/${page._key}/objects/${object._key}`;
        if (action == UpdateObjectActionType.update || action == UpdateObjectActionType.add) {
            this.setPageObject(noteContent, page, object, userId);
        } else if (action == UpdateObjectActionType.updateObjects) {
            let objects = object;
            _log('updatePageObject::updatObjects objects =>', objects);
            for (let _object of objects) {
                this.setPageObject(noteContent, page, _object, userId);
            }
        } else if (action == UpdateObjectActionType.delete) {
            await this.api.deleteByNode(objPath);
            await this.repositionObjects(noteContent, page);    // 추가 할때 마지막 item.seq + 1이 아니라 현재 objects의 index를 저장하기 때문에 reposition해줘야 함
        } else if (action == UpdateObjectActionType.reorder) {
            await this.repositionObjects(noteContent, page);
        }

        // object 추가, 수정, 삭제, 순서변경(seq)
        // setPageObject, deleteByNode, repositionObjects

        // 노트에 업데이트 날짜 갱신
        await this.updateUpdateDateOfNote(note);
        await this.updateUpdateDateOfPage(noteContent, page);
        _log('updatePageObject page, noteContent =>', page, noteContent);

        return noteContent;
    }

    async setPageObject(noteContent: NPNoteContent, page: NPPage, object: any, userId: string): Promise<any> {
        _flog(this.setPageObject, arguments);
        _valid(noteContent);
        _valid(userId);

        // seq
        let seq = page.objects.findIndex(_object => _object._key == object._key);
        _valid(seq !== -1);
        if (seq < 0) { return noteContent; }
        _log('setPageObject noteContent, page, object, objectIndex, seq =>', noteContent, page, object, seq);

        let objPath = `NPNoteContent/${noteContent._key}/pages/${page._key}/objects/${object._key}`;

        // object를 수정하고 저장했는데 페이지를 바꿔도 반영이 안되는 버그 수정
        // save object : 이 경우만 이미지url에서 토큰을 제거 하고 저장한다.
        let respObject: any = await this.api.setByNode(objPath, object, true, ['text'], true, userId, seq);
        if (!respObject) { throw new Error(); }
        _valid(respObject);
        let _respObject: any = await this.api._saveDocToDoc(respObject, true);
        _log('setPageObject _respObject =>', _respObject);
        page.objects[seq] = _respObject;

        // object는 변경 전 오브젝트
        // _object는 변경 된 오브젝트
        // 그럼 page에서 object를 _object로 바꾸면 바로 갱신 됨 

        // save search text
        await this._setObjectTextForSearch(object, objPath, userId);
    }

    // async _updatePageObject(noteContent:NPNoteContent, page: NPPage, object: any) {
    //     let objPath = `NPNoteContent/${noteContent._key}/pages/${page._key}/objects/${object._key}`;
    //     _log('_updatePageObject objPath, object, object.text =>', objPath, object, object.text);

    //     // save object
    //     let _object: any = await this.api.updateByNode(objPath, object, true, ['text'], this.loginedUserId); // seq를 바꾸지 않음
    //     if (!_object) { throw new Error(); }
    //     _valid(_object);     

    //     // save search text
    //     await this._setObjectTextForSearch(object, objPath, this.loginedUserId);      //     
    // }

    async repositionObjects(noteContent: NPNoteContent, page: NPPage) {
        _log('repositionObjects page.objects =>', page.objects); // 이미 삭제된 data
        let i = 0;
        for (let object of page.objects) {
            let objPath = `NPNoteContent/${noteContent._key}/pages/${page._key}/objects/${object._key}`;
            await this.api.updateByNode(objPath, { seq: i });
            i++;
        }
    }

    // object 삭제의 저장 ???

    // 두 페이지를 비교해서 다른 부분만 저장
    // object의 내용에 대한 변경은 고려대상이 아님 
    // object의 추가, 삭제, 순서의 변경 만 저장 대상임 // 
    // let objectPath = `NPNoteContent/${noteContent._key}/pages/${page._key}/objects/${object._key}`; 
    async updateNotePageObjectsDiffer(noteContent: NPNoteContent, page: NPPage, oldObjects: Array<any>, newObjects: Array<any>, userId: string) {
        let pagePath = `NPNoteContent/${noteContent._key}/pages/${page._key}`;
        await this.updateUpdateDateOfPage(noteContent, page); // 노트에 업데이트 날짜 갱신
        return this._updatePageDifferByPagePath(pagePath, oldObjects, newObjects, userId, true);
    }

    // object를 삭제한 경우 
    async _updatePageDifferByPagePath(pagePath: string, oldObjects: Array<any>, newObjects: Array<any>, userId: string, isSaveSearchText: boolean = false) {
        _valid(oldObjects);
        _valid(newObjects);
        _valid(userId);

        _log('_updatePageDifferByPagePath pagePath, oldObjects, newObjects =>', pagePath, oldObjects, newObjects);

        let seq = 0;
        for (let object of newObjects) {
            _valid(object._key);
            if (!object._key) { continue; }
            let objectPath = `${pagePath}/objects/${object._key}`;
            let oldObjectSeq = oldObjects.findIndex(obj => obj._key == object._key);
            if (oldObjectSeq != -1) {
                if (seq !== oldObjectSeq) {
                    // seq만 업데이트
                    _log('_updatePageDifferByPagePath::update::seq objectPath, seq =>', objectPath, seq);
                    await this.api.updateByNode(objectPath, { seq: seq });
                }
            } else {
                // save object
                _log('_updatePageDifferByPagePath::add objectPath, _object, seq =>', objectPath, object, seq);
                let _object: any = await this.api.setByNode(objectPath, object, true, ['text'], true, userId, seq);
                // save search text
                if (isSaveSearchText) {
                    await this._setObjectTextForSearch(object, objectPath, userId);
                }
            }
            seq++;
        }

        // 없는 object삭제
        for (let object of oldObjects) {
            _valid(object._key);
            if (!object._key) { continue; }
            let newObject = newObjects.find(obj => obj._key == object._key);
            if (!newObject) {
                let objectPath = `${pagePath}/objects/${object._key}`;
                _log('_updatePageDifferByPagePath::delete objectPath =>', objectPath);
                await this.api.deleteByNode(objectPath);
            }
        }

    }

    // async deletePageObject(note: NPNote, noteContent: NPNoteContent,  pageKey: string, object: any): Promise<NPNoteContent> {


    // }

    // 정확히 텍스트가 일치하는 경우만 동작함 

    // async search(keyword: string, userId: string): Promise<INPNoteSearchResultParams> {
    //     let respNotes = await this.searchNote(keyword, userId);
    //     return { notes: respNotes, pages: [] };
    // }

    // async searchNote(keyword: string, userId: string): Promise<Array<NPNote>> {
    //     let respNotes = await this.api.search(keyword, 'NPNote', ['name'], { userId: userId, isDeleted: false });
    //     // let respPages : Array<INPSearchResultPage> = await this._searchNotes(keyword, userId);
    //     _log('searchNote keyword, respNotes =>', keyword, respNotes);
    //     // return {notes: respNotes, pages: respPages};
    //     return respNotes;
    // }

    // private async _searchNotes(keyword: string, userId: string) {
    //     let refPaths: Array<any> = []; // ['/path/to/node1', '/path/to/node2', '/path/to/node3'];
    //     let refNote: Array<any> = [];

    //     let notes = await this.listMyNotes(userId);
    //     for(let note of notes) {
    //         let noteContent: NPNoteContent = await this.getNoteContent(note);
    //         _valid(noteContent);

    //         for(let pageIdx = 0; pageIdx < noteContent.pages.length; pageIdx++) {
    //             refPaths.push(`/NPNoteContent/${noteContent._key}/pages/${pageIdx}/objects`);
    //             refNote.push({
    //                 noteKey: note._key,
    //                 noteName: note.name,
    //                 pageNumber: pageIdx + 1,
    //             });
    //         }
    //     }
    //     _log('_searchNote refPaths =>', refPaths);
    //     let result: any = await this.api.searchInNodes(keyword, refPaths, ['text']);
    //     _log('_searchNote result =>', result);

    //     let respPages : Array<INPSearchResultPage> = [];
    //     for(let i = 0; i <= result.length; i++) {
    //         if(result[i] && result[i].length > 0) {
    //             for(let item of result[i]) {
    //                 _valid(item);
    //                 respPages.push(this._objectToSearchResultPage(item, refNote[i], notes));
    //             }
    //         }
    //     }
    //     return respPages;
    // }

    // private _objectToSearchResultPage(object: any, refNote: any, notes: Array<NPNote>): INPSearchResultPage {
    //     _valid(object.text);
    //     _valid(refNote);
    //     _valid(notes)
    //     let note: NPNote | undefined = notes.find(note => note._key == refNote.noteKey);
    //     if (!note) { 
    //         throw new Error();
    //     }
    //     let result: INPSearchResultPage = {
    //         noteKey: note._key,
    //         noteName: note.name,
    //         pageNumber: refNote.pageNumber,
    //         updateDate: note.updateDate,
    //         content: object.text,
    //     };
    //     return result;
    // }

    // function findDataWithKeyword(refPaths, field, keyword) {
    //     const queries = refPaths.map((refPath) => {
    //       return new Promise((resolve, reject) => {
    //         const query = database.ref(refPath)
    //           .orderByChild(field)
    //           .startAt(keyword)
    //           .endAt(keyword + '\uf8ff');

    //         query.once('value', (snapshot) => {
    //           const results = [];
    //           snapshot.forEach((childSnapshot) => {
    //             const data = childSnapshot.val();
    //             results.push(data);
    //           });
    //           resolve(results);
    //         }, (error) => {
    //           reject(error);
    //         });
    //       });
    //     });

    //     return Promise.all(queries);
    //   }

    //   // 예시 사용
    //   const refPaths = ['/path/to/node1', '/path/to/node2', '/path/to/node3'];
    //   findDataWithKeyword(refPaths, 'fieldName', 'keyword')
    //     .then((results) => {
    //       console.log('검색 결과:', results);
    //     })
    //     .catch((error) => {
    //       console.error('검색 중 오류 발생:', error);
    //     });

    // getVPageNumber(note: NPNote, noteContent: NPNoteContent, pageNumber: number) {
    //     _valid(note);
    //     _valid(noteContent);
    //     _valid(pageNumber > 0);
    //     let pageVNumber = note.isAddForward ? noteContent.pages.length - pageNumber + 1 : pageNumber;
    //     return pageVNumber;
    // }

    // getPageNumberFromVpageNumber(note: NPNote, noteContent: NPNoteContent, vPageNumber: number) {
    //     _valid(note);
    //     _valid(noteContent);
    //     _valid(vPageNumber > 0);
    //     let pageNumber = note.isAddForward ? noteContent.pages.length - vPageNumber + 1 : vPageNumber;
    //     return pageNumber;
    // }

    /* -------------------------------------------------------------------------- */
    /*                             objects text #search                           */
    /* -------------------------------------------------------------------------- */
    async _setObjectsTextForSearch(objects: Array<any>, objectsPath: string, userId: string) {
        let objIndex = 0;
        for (let object of objects) {
            await this._setObjectTextForSearch(object, `${objectsPath}/${objIndex}`, userId);
            objIndex++;
        }
    }

    async _setObjectTextForSearch(object: any, objectPath: string, userId: string) {
        _log('_setObjectTextForSearch object, objectPath, userId =>', object, object.text, objectPath, userId);

        // text 가 없으면 pass
        if (!object || !object.text || object.text.length == 0) { return; }

        let target = /\//g;
        let key = objectPath.replace(target, '*'); // firebase store의 key로 / 문자를 포함 할 수 없어서 변환 함
        _log('_setObjectTextForSearch object, objectPath, userId =>', object, object.text, objectPath, userId);
        await this.api.set('NPObjectTextSearch', key, { text: object.text, userId: userId });
    }

    /* -------------------------------------------------------------------------- */
    /*                               #sync                                        */
    /* -------------------------------------------------------------------------- */

    /*
        NoteList

        *위치
        NPSync/{userId}/updateDateOfNoteList

        *update 시점
        노트를 추가, 삭제 한 경우
        노트의 이름을 변경 한 경우
        노트를 북마크 한 경우
    */
    async updateUpdateDateOfNoteList(userId: string) {
        _flog(this.updateUpdateDateOfNoteList, arguments);
        await this.api.set('NPSync', userId, {
            userId: userId,
            updateDateOfNoteList: CFDate.nowAsString()
        });
    }

    async getUpdateDateForSync(userId: string) {
        _flog(this.getUpdateDateForSync, arguments);
        return this.api.get('NPSync', userId, false);
    }


    // #sync #page
    async getLastUpdateDateOfPageFromServer(noteContent: NPNoteContent, page: NPPage): Promise<any> {
        let pagePath = `NPNoteContent/${noteContent._key}/pages/${page._key}`;
        let _page: NPPage = await this.api.getByPath(pagePath, false, false);
        if (!_page) return null;
        _log('getLastUpdateDateOfPageFromServer pagePath, _page.updateDate =>', pagePath, _page.updateDate);
        return _page.updateDate;
    }

    async getLastUpdateDateOfNoteFromServer(note: NPNote, userId: string): Promise<any> {
        let _note: NPNote | undefined = await this.getNote(note._key, userId);
        if (!_note) return null;
        _log('getLastUpdateDateOfNoteFromServer note, _note =>', note, _note);
        return _note.updateDate;
    }

    async isUpdatedNote(note: NPNote, userId: string) {
        _valid(note && userId)
        if (!note || !userId) return false;

        // get loacal time
        let updateDateLocalPage = note.updateDate;

        // get server time
        let updateDateServerPage = await this.getLastUpdateDateOfNoteFromServer(note, userId);

        // 페이지 시간 변화 체크
        let dateLocalPage: Date;
        let dateServerPage: Date;
        try {
            dateLocalPage = new Date(updateDateLocalPage);
            dateServerPage = new Date(updateDateServerPage);
        } catch {
            return false;
        }
        _log('isUpdatedNote updateDateLocalPage, updateDateServerPage, result =>', updateDateLocalPage, updateDateServerPage, dateLocalPage < dateServerPage)
        return dateLocalPage < dateServerPage;
    }


    async isUpdatedPage(noteContent: NPNoteContent, page: NPPage) {
        _valid(page && noteContent)
        if (!page || !noteContent) return false;

        // get loacal time
        let updateDateLocalPage = page.updateDate;

        // get server time
        let updateDateServerPage = await this.getLastUpdateDateOfPageFromServer(noteContent, page);

        // 페이지 시간 변화 체크

        let dateLocalPage: Date;
        let dateServerPage: Date;
        try {
            dateLocalPage = new Date(updateDateLocalPage);
            dateServerPage = new Date(updateDateServerPage);
        } catch {
            return false;
        }
        _log('isUpdatedPage updateDateLocalPage, updateDateServerPage, result =>', updateDateLocalPage, updateDateServerPage, dateLocalPage < dateServerPage)
        return dateLocalPage < dateServerPage;
    }




    /* -------------------------------------------------------------------------- */
    /*                                 #date                                      */
    /* -------------------------------------------------------------------------- */

    // 노트가 변경될 때 수동으로 updateDate를 갱신한다. // update함수 사용하니 퍼미션 오류남
    async updateUpdateDateOfNote(note: NPNote) {
        // api에서 서버 시간이 들어가기 때문에 여기서는 임시 로컬 시간
        if (note && note.updateDate) {
            note.updateDate = CFDate.nowAsString();
        }
        let _note: NPNote = await this.api.update('NPNote', note._key, { updateDate: CFDate.nowAsString() });
        note.updateDate = _note.updateDate;
        return note;
    }

    // Page가 변경될 때 수동으로 page의 updateDate를 변경한다. // object가 변경될 때 호출 해준다.
    // update함수 사용하니 퍼미션 오류남
    async updateUpdateDateOfPage(noteContent: NPNoteContent, page: NPPage) {
        let pagePath = `NPNoteContent/${noteContent._key}/pages/${page._key}`;
        _log('updateUpdateDateOfPage page.updateDate =>', page.updateDate)
        let _page: NPPage = await this.api.updateByNode(pagePath, { updateDate: CFDate.nowAsString() })
        page.updateDate = _page.updateDate;
        return page;
    }


    getDateWithPage(page?: NPPage): NPDateType | undefined {
        if (!page || !page.date || page.date.length == 0) { return undefined; }
        const _date = new Date(page.date);
        return this.getDateWithDateString(page.date);
    }

    getDateWithDateString(dateSting: string) {
        const _date = new Date(dateSting);
        return this.getDateWithDate(_date);
    }

    getDateWithDate(date: Date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 월은 0부터 시작하므로 +1을 해야 합니다.
        const day = date.getDate();
        //_log('pageToActiveDate activeDate =>', this.activeDate);
        return { year: year, month: month, day: day };
    }

    isSameDateWithPage(pageA: NPPage, pageB: NPPage) {
        let dateA = this.getDateWithPage(pageA);
        let dateB = this.getDateWithPage(pageB);
        if (!dateA || !dateB) { return false; }
        return this.isSameDate(dateA, dateB);
    }

    isSameDate(dateA: NPDateType, dateB: NPDateType) {
        return dateA.year == dateB.year && dateA.month == dateB.month && dateA.day == dateB.day;
    }


    /* -------------------------------------------------------------------------- */
    /*                            #stickerPack                                    */
    /* -------------------------------------------------------------------------- */

    // createStickerPackage(userId: string, name: string, coverImageURI?: string) {
    //     let stickerPack: NPStickerPack = new NPStickerPack(name, userId, userId, coverImageURI);
    //     return this.api.create('NPStickerPack', stickerPack);
    // }

    // async listMyCreatedStickerPack(userId: string): Promise<Array<NPStickerPack>> {
    //     return this.api.listByFilter('NPStickerPack', {creatorId: userId, userId: userId, downloaderId: ''}, false, 'updateDate', FBOrderDirection.desc);
    // }

    // async getStickerPack(key: string): Promise<NPStickerPack> {
    //     _valid(key != null);
    //     return new Promise((resolve, reject) => {
    //         this.api.get('NPStickerPack', key).then((resp: any) => { 
    //             _log('CFNoteAPI::getStickerPack resp =>', resp);
    //             if (!_valid(resp != null)) {
    //                 throw Error();
    //             };
    //             resolve(resp);
    //         }).catch(() => { reject(); });
    //     });
    // }

    // async listMyDownloadStickerPack(userId: string): Promise<Array<NPStickerPack>> {
    //     let list: Array<NPStickerPack> = [];
    //     let stickerPacks = await this.api.listByFilter('NPStickerPack', {userId: userId, downloaderId: userId}, false, 'updateDate', FBOrderDirection.desc);
    //     _log('listMyDownloadStickerPack stickerPacks =>', stickerPacks);
    //     return stickerPacks;
    // }

    // 내가 만든 스티커팩 인지?
    // isStickerPackICreate(stickerPack: NPStickerPack, userId: string) {
    //     return (stickerPack.creatorId == userId);
    // }

    // async updateStickerPack(stickerPack: NPStickerPack) {
    //     return this.api.set('NPStickerPack', stickerPack._key, stickerPack);
    // }

    // async deleteStickerPack(stickerPack: NPStickerPack) {
    //     return this.api.delete('NPStickerPack', stickerPack._key);
    // }

    // async downloadStickerPack(stickerPack: NPStickerPack, userId: string) {
    //     // if (!template.id || template.id.length == 0) {
    //     //     throw new Error(NPError.stickerFileReadFail);
    //     // }
    //     let _stickerPack = await this.copyStickerPack(stickerPack);
    //     _stickerPack.userId = userId;
    //     _stickerPack.downloaderId = userId;
    //     return this.updateSticerPack(_stickerPack);
    // }

    // 공개된 페이지템플릿 리스트
    // async listPublicStickerPacks() {
    //     return this.api.listByFilter('NPStickerPack', {isPublished: true}, false, 'updateDate', FBOrderDirection.desc);
    // }

    // async updateStickerPackCoverFromFile(stickerPack: NPStickerPack, uri: string) {
    //     _log('updateStickerPackCoverFromFile uri =>', uri);
    //     stickerPack.coverImageURI = uri;
    //     return this.api.set('NPStickerPack', stickerPack._key, stickerPack);
    // }

    /* -------------------------------------------------------------------------- */
    /*                            #sticker                                        */
    /* -------------------------------------------------------------------------- */
    async createSticker(stickerPack: NPStickerPack, userId: string, uri: string) {
        _log('createSticker uri =>', uri);
        let sticker = new NPSticker(stickerPack._key, userId, userId, uri); // tags를 그냥 name에 저장함
        return this.api.create('NPSticker', sticker);
    }

    // async copySticker(sticker: NPSticker, newStickerPack: NPStickerPack) {
    //     _log('copySticker sticker, newStickerPack =>', sticker, newStickerPack);
    //     // 기본 template 값 복사 
    //     let _sticker = new NPSticker('', '', '',  '', '');
    //     CFHelper.object.copyValue(_sticker, sticker, '_key');    // 키를 제외하고 복사!!!! 이렇게 해야 복사본과 key가 다르게 됨

    //     try {
    //         _sticker.parentItemKey = newStickerPack._key;    
    //         // copy cover image
    //         if (sticker.imageURI) {
    //             _sticker.imageURI = await this.copyImage(sticker.imageURI, sticker.creatorId);
    //         }
    //     } catch(e: any) {
    //         _log('copyPageTemplate error =>', e);
    //         throw new Error(e);
    //     }
    //     this.api.set('NPSticker', _sticker._key, _sticker);
    //     return _sticker;
    // }

    // async listSticker(stickerPack: NPStickerPack) {
    //     _valid(stickerPack);
    //     return this.api.listByFilter('NPSticker', { stickerPackKey: stickerPack._key}, false, 'updateDate', FBOrderDirection.desc);
    // }

    // async getSticker(key: string): Promise<NPSticker> {
    //     _valid(key != null);
    //     return new Promise((resolve, reject) => {
    //         this.api.get('NPSticker', key).then((resp: any) => { 
    //             _log('CFNoteAPI::getSticker resp =>', resp);
    //             if (!_valid(resp != null)) {
    //                 throw Error();
    //             };
    //             resolve(resp);
    //         }).catch(() => { reject(); });
    //     });
    // }

    // async deleteSticker(sticker: NPSticker) {
    //     _valid(sticker);
    //     return this.api.delete('NPSticker', sticker._key);
    // }

    // async updateSticker(sticker: NPSticker) {
    //     _valid(sticker);
    //     return this.api.set('NPSticker', sticker._key, sticker);
    // }

    /* -------------------------------------------------------------------------- */
    /*                                   #trash                                   */
    /* -------------------------------------------------------------------------- */
    // 내가 삭제한 노트 
    async listMyDeletedNote(userId: string, useCache: boolean = true): Promise<Array<NPNote>> {
        return this.api.listByFilter('NPNote', { userId: userId, isDeleted: true }, false, useCache, useCache, 'updateDate', FBOrderDirection.desc);
    }

    async restoreNote(key: string, userId: string) {
        let note: NPNote | undefined = await this.getNote(key, userId);
        if (!_valid(note != null)) { return; }
        if (!note) { return; }
        note.isDeleted = false;
        this.updateUpdateDateOfNoteList(userId); // #sync 노트리스트에 변경이 있었음
        return this.api.set('NPNote', key, note);
    }

    async trashNote(note: NPNote, userId: string) {
        _log('trashNote note =>', note);
        if (!_valid(note != null && note._key != null)) return;
        note.isDeleted = true;
        this.updateUpdateDateOfNoteList(userId); // #sync 노트리스트에 변경이 있었음
        return this.api.set('NPNote', note._key, note);
    }

    async deleteNote(note: NPNote, userId: string) {
        _log('daleteNote note =>', note);
        if (!_valid(note != null && note._key != null)) return;

        let noteContent = await this.getNoteContentByNote(note, userId);
        if (noteContent) {
            for (let page of noteContent.pages) {
                this.api.deleteCollection(`NPNoteContent/${noteContent._key}/pages/${page._key}/objects`, userId);
            }
            this.api.deleteCollection(`NPNoteContent/${noteContent._key}/pages`, userId);
        }
        await this.api.delete('NPNoteContent', note.contentKey);
        return await this.api.delete('NPNote', note._key);
    }

    async emptyTrash(userId: string) {
        let result: boolean = false;
        let notes: Array<NPNote>;
        try {
            notes = await this.listMyDeletedNote(userId);
            for (let note of notes) {
                await this.deleteNote(note, userId);
            }
            result = true;
        } catch (error) {
            result = false;
            throw new Error();
        }
        return notes;
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #Resources                                */
    /* -------------------------------------------------------------------------- */

    async createSvgResource(type: NPResourceType, data: string, userId: string, auth?: NPAuth): Promise<string> {
        let resource: NPResource = new NPResource(type, data, userId, auth);

        let res: NPResource = await this.api.create('NPResource', resource, resource._key);
        //res.uri = `np${type}://${res._key}`; // !! 주의 다시 바뀐 key로 uri만들어 줌 
        await this.api.set('NPResource', res._key, res);
        return res.uri;
    }

    async removeResource(uri: string, userId: string) {
        let resource: NPResource = await this.getResource(uri, userId);
        if (!_valid(resource != null)) { return; }
        await this.api.delete('NPResource', resource._key);
    }

    async copySvgResource(uri: string, toUserId: string, fromUserId: string, auth?: NPAuth) {
        let resource: NPResource = await this.getResource(uri, fromUserId);
        if (!_valid(resource)) { return; }
        _log('copySvgResource =>', resource);
        if (toUserId == 'public') {
            auth = NPAuth.public;
        }
        return this.createSvgResource(resource.type, resource.data, toUserId, auth);
    }

    async updateSvgResource(uri: string | undefined, data: string, userId: string) {
        let res: NPResource;
        // 없으면 create
        if (!uri || uri.length == 0) {
            let _res = await this.createSvgResource(NPResourceType.svg, data, userId);
            return _res;
        }

        // update
        res = await this.getResource(uri, userId);
        _log('updateSvgResource uri, res.data, data =>', uri, res.data == data)
        if (res.data == data) return res.uri;
        res.data = data;
        await this.api.set('NPResource', res._key, res);

        // cache update
        if (this._resourceCache[res.uri]) {
            this._resourceCache[res.uri] = res.data;
        }

        return res.uri;
    }

    private _resourceCache: any = {};
    async getResourceData(uri: string, userId: string, auth?: NPAuth): Promise<any> {
        let res = this._parseURIExceptData(uri);
        if (!_valid(res.type == 'svg')) return; // 이 함수는 svg에만 유효함
        if (!uri || uri.length == 0) { return; }
        return new Promise((resolve, reject) => {
            let resourceData = this._resourceCache[uri];
            //_log('getResource _resourceCache =>', this._resourceCache);         
            if (resourceData) {
                _valid(resourceData != null);
                //_log('getResource from cache =>', resourceData);
                resolve(resourceData);
            } else {
                this.getResource(uri, userId, auth).then((resp: any) => {
                    _valid(resp.data != null);
                    //_log('getResourceData data =>', resp.data);
                    let data = CFHelper.svg.convertToUniqueClassName(resp.data);
                    this._resourceCache[uri] = data;
                    resolve(data);
                }, (error: any) => {
                    throw error;
                });
            }
        });
    }

    async getResource(uri: string, userId: string, auth?: NPAuth): Promise<any> {
        if (!uri || uri.length == 0) { return; }
        return new Promise((resolve, reject) => {
            let filter: any = { uri: uri, userId: userId };
            // auth가 없으면 private, public일 경우만 넣어주면 됨
            // if (auth == NPAuth.public) {
            //     params['auth'] = auth;
            // }

            this.api.getByFilter('NPResource', filter).then((resp: any) => {
                _valid(resp != null);
                _log('getResource resp =>', resp);
                resolve(resp);
            }, (error: any) => {
                throw error;
            });
        });
    }

    // 앞으로 이미지 가져올때 이 함수 씀 
    // 결과에 svg일떄 data / 아니면 그냥 type만 넣어줌
    async getImage(resURI: string): Promise<INPImage> {
        if (!_valid(resURI != null && resURI.length > 0)) return { type: NPImageType.undefined, data: '', uri: resURI, userId: '', auth: '' };
        return await this.parseURI(resURI);
    }

    // 여기서는 type만 정한다.
    _parseURIExceptData(uri: string) {
        let res: INPImage = { data: '', type: NPImageType.undefined, uri: '', userId: '', auth: '' }
        try {
            // `np${type}://${this._key}:${this.userId}:${this.auth}`
            let uris = uri.split(':');
            _log('parseURI uris =>', uris);

            // uri
            res.uri = uri;

            // type
            if (uris[0] == 'npsvg') {
                res.type = NPImageType.svg;
            } else if (uris[0] == 'http' || uris[0] == 'https') {
                res.type = NPImageType.image;
            }

            // userId
            if (uris[2]) {
                res.userId = uris[2];
            }

            // auth
            if (uris[3]) {
                res.auth = uris[3];
            }
        } catch (e) {
            _valid(false)
            throw new Error('이미지URI 파싱오류');
        }
        return res;
    }

    // 여기서 svg데이타 넣음
    async parseURI(uri: string): Promise<INPImage> {
        let res = this._parseURIExceptData(uri);
        if (res.type == 'svg') {
            res.data = await this.getResourceData(uri, res.userId, res.auth as NPAuth);
        }
        return res;
    }

    /* -------------------------------------------------------------------------- */
    /*                            #rerender : 효율적 화면 갱신                     */
    /* -------------------------------------------------------------------------- */
    // 그냥 두면 값 변경이 없어서 화면 갱신이 안됨 
    // 그래서 빈 값을 넣어주고 다시 복구 함 
    // 빈 값만 넣어줘도 이상하게 업데이트가 잘 되고 값은 null인데 이는 더 확인이 필요함
    async rerenderCoverImageOfNoteInItemList(item: NPItem, itemList: Array<NPItem>) {
        _flog(this.rerenderCoverImageOfNoteInItemList, arguments);
        _valid(item);
        if (!itemList || itemList.length == 0) { return; }

        let __item = itemList.find(_item => _item._key == item._key);
        let coverImageURI = item.coverImageURI;
        if (!coverImageURI) { return; }
        if (!__item) { return; }

        // rerender
        __item.coverImageURI = '';
        setTimeout(() => {
            if (__item) { __item.coverImageURI = coverImageURI; }
        }, 1)
        setTimeout(() => {
            if (__item) { __item.coverImageURI = coverImageURI; }
        }, 100)

        // sort
        const now = new Date();
        __item.updateDate = now.toISOString();
        itemList.sort((a, b) => {
            const dateA: any = new Date(a.updateDate);
            const dateB: any = new Date(b.updateDate);
            return dateB - dateA;
        });
        _log('rerenderCoverImageOfNoteInItemList itemList[index] =>', itemList, __item); // 여기서 itemList

    }

    async rerenderNameOfItemList(item: NPItem, itemList: Array<NPItem>) {
        // _valid(item);
        let _item: NPItem | undefined = itemList.find(__item => item._key == __item._key);
        if (_item) {
            _item.name = item.name;
        }
        // return new Promise((resolve, reject) => {
        //     let name = item.name;
        //     if (!name) { return; }
        //     if (!_item) { return; }
        //     _item.name = '';
        //     setTimeout(() => {
        //         if (_item) {
        //             _item.name = name;
        //             _log('rerenderNameOfItemList _item =>', _item)
        //             resolve({});
        //         }
        //     },1)
        // });
    }

    /* -------------------------------------------------------------------------- */
    /*                              #publish #product                             */
    /* -------------------------------------------------------------------------- */

    // pageTemplate, stickerPack
    // #발행신청, #수정신청 시 db에 NPProduct 저장함
    async createProduct(product: NPProduct, item: NPItem, userId: string, approveType: NPProductApproveType = NPProductApproveType.before): Promise<NPProduct> {
        _log('createProduct product =>', product);
        _valid(product);

        product.tags = product.tags.map((tag: string) => tag.replace(/\n/g, ""));
        product.tagPrice = product.price;
        product.oriItemKey = item._key;
        product.publicItemKey = '';
        product = await this.api.create('NPProduct', product, product._key); // product._key값으로 문서를 만든다.
        if (product) {
            // thumbImageURI 생성
            if (product.thumbImageURI && item.coverImageURI && !product.isUserSetCoverImage) {
                // item.coverImage => product.thmbImageURI로 전체공개 / 복사 
                product.thumbImageURI = await this.copyImage(item.coverImageURI, item.userId, item.userId, NPAuth.public);
            }
            // product 수정
            product.approve = approveType; //NPProductApproveType.wait;
            product.approveMessage = `발행에 적합한지 판단 후 스토어에 노출 됩니다. 바로 노출을 원하지 않으시면 공개 설정을 '비공개'로 해주세요.`;
            await this.setProduct(product, item);

            // item 수정
            // item.productKey = product._key;
            // item.name = product.name;
            // await this.api.update(product.type, item._key, {
            //     productKey: product._key,
            //     name: product.name
            // });

        } else {
            // error
        }
        return product;
    }

    async updateProduct(product: NPProduct, data: any) {
        return await this.api.update('NPProduct', product._key, data);
    }

    async setProduct(product: NPProduct, item?: NPItem, approveType?: NPProductApproveType) {
        _flog(this.setProduct, arguments);
        if (approveType !== undefined) {
            product.approve = approveType;
        }
        product.tags = product.tags.map((tag: string) => tag.replace(/\n/g, ""));
        product.tagPrice = product.price;

        // update Item name
        if (item) {
            // 사용자가 이미지 지정을 하지 않았다면 여기서 저장한다.
            if (product.thumbImageURI && item.coverImageURI && !product.isUserSetCoverImage) {
                // item.coverImage => product.thmbImageURI로 전체공개 / 복사 
                product.thumbImageURI = await this.copyImage(item.coverImageURI, item.userId, item.userId, NPAuth.public);
            }
            item.name = product.name;
            item.productKey = product._key;
            await this.api.update(product.type, item._key, {
                productKey: product._key,
                name: product.name
            });
        }
        // update Product
        return await this.api.set('NPProduct', product._key, product);
    }

    async getProduct(productKey: string) {
        let product: NPProduct = await this.api.get('NPProduct', productKey);
        // user 정보
        // let user = await this.getUserInfo(product.creatorId);

        return product;
    }

    // 최신순으로 가져옴
    async listProductByProductId(productId: string) {
        return this.api.listByFilter('NPProduct', { productId: productId }, false, true, true, 'updateDate', FBOrderDirection.desc);
    }

    // 발행 승인 요청 상품 리스트
    // byapproveType
    async listProductByApproveType(approveType: NPProductApproveType) {
        return this.api.listByFilter('NPProduct', { approve: approveType }, false, true, true, 'updateDate', FBOrderDirection.desc);
    }

    // 발행된 상품 리스트
    //approve-open-type
    // 
    async listPublishedProduct(type?: NPItemType, tags?: Array<string>, createorId?: string, isOpen?: boolean) {
        let filters: any = { approve: NPProductApproveType.approve };
        if (isOpen !== undefined) {
            filters.isOpen = isOpen;
        }
        if (type !== undefined) {
            filters.type = type;
        }
        if (tags !== undefined) {
            filters.tags = tags;
        }
        if (createorId !== undefined) {
            filters.creatorId = createorId;
        }

        return this.api.listByFilter('NPProduct', filters, false, true, true, ['orderPriority', 'updateDate'], FBOrderDirection.desc);
    }

    //{ tags: ['노트'] }

    async hasProduct(prodcut: NPProduct, userId: string): Promise<boolean> {
        _log('hasProduct product, userId =>', prodcut, userId);
        return new Promise((resolve, reject) => {
            // productType 이 entity 이름임 
            this.api.getByFilter(prodcut.type, { productKey: prodcut._key, userId: userId }).then((resp: any) => {
                _log('CFNoteAPI::hasProduct resp =>', resp);
                if (!resp) { resolve(false); }
                resolve(true);
            }).catch(() => { reject(); });
        });
    }

    // #download
    async downloadProduct(product: NPProduct, userId: string) {
        _log('downloadProduct product, userId =>', product, userId);
        if (!product.publicItemKey || product.publicItemKey.length == 0) {
            _valid(false);
            return;
        }
        let item = await this.getItemByKey(product.type, product.publicItemKey);
        _log('downloadProduct item =>', item);

        _valid(item);
        if (!item) { throw new Error(''); }
        await this._downloadItem(item, userId); // 아이템을 userId로 복사하고 downloader로 지정한다.
        _log('downloadProduct complate =>');
    }

    async downloadByProductId(productId: string, userId: string, isOnlyOne: boolean = false) {
        let products = await this.listProductByProductId(productId);
        _valid(products && products.length > 0);
        let product = products[0]; // 최신 것만 의미가 있음
        // 이미 있으면 패스
        if (isOnlyOne) {
            let has = await this.isDownloadedProduct(product, userId);
            if (has) { return; }
        }
        await this.downloadProduct(product, userId);
        return products;
    }

    async downloadByProductKey(productKey: string, userId: string, isOnlyOne: boolean = false) {
        let product = await this.getProduct(productKey);
        _log('downloadByProductKey product =>', product);
        // 이미 있으면 패스
        if (isOnlyOne) {
            let has = await this.isDownloadedProduct(product, userId);
            _log('downloadByProductKey has =>', has);
            if (has) { return; }
        }
        await this.downloadProduct(product, userId);
        return product;
    }

    // 내가 받은 상품인지? 받은 아이템에 productKey를 비교함
    async isDownloadedProduct(product: NPProduct, userId: string) {
        let list = await this.api.listByFilter(product.type, { productKey: product._key, downloaderId: userId, userId: userId });
        return list && list.length > 0;
    }

    // product id가 필요할 때   -> 같은 상품을 업데이트(지금 안됨) : 템플릿을 업데이트하면 노트를 새로 만들어야 함
    // 

    // async isDownloadedProductById(product: NPProduct, userId: string) {
    //     let list = await this.api.listByFilter(product.type, { oriItemKey: product.oriItemKey, downloaderId: userId, userId: userId });
    //     return list && list.length > 0;
    // }

    // 상품으로 되기전에 복사해줌 
    // 어드민에서 승인 시 불림 
    // 원 상품에서 복사해서 publicItemKey 넣어준다. 
    async publishProductByProductKey(productKey: string) {
        let product = await this.getProduct(productKey);
        this.publishProduct(product);
    }

    // #publish
    async publishProduct(product: NPProduct) {
        _valid(product.oriItemKey);
        if (!product.oriItemKey || product.oriItemKey.length == 0) { return; }

        // product
        product.approve = NPProductApproveType.approve;
        product.approveMessage = "승인 처리되었습니다.";

        // item         
        let item = await this.getItemByKey(product.type, product.oriItemKey);
        _log('publishProduct item =>', item);
        _valid(item);
        if (!item) {
            alert('원본 아이템이 존재하지 않습니다. 승인 신청 후 상품이 삭제되었을 수 있습니다.');
            return;
        }
        if (item) {
            // item을 public으로 복사
            try {
                let _item = await this.copyItem(item, 'public');  // 아이템 복사할 때 / 템플릿의 경우 objects도 같이 복사해줘야 함
                _valid(_item);
                await this.setItem(_item, 'public');  // 여기서 db에 저장하는데 이때 objects도 저장함 
                // product와 연결
                _valid(_item._key);
                product.publicItemKey = _item._key;
            } catch (e) {
                _log('error =>', e);
                alert('내부오류 : 승인처리중 오류 발생');
            }
        }

        // 프로덕트를 저장하는데 item은 저장하지 않음 / 위에서 이미지 저장했음 / item에 프로덕트키는 이미 연결되어 있음
        this.setProduct(product, undefined);
    }

    // 내가 만든 상품 인지?
    isProductICreate(product: NPProduct, userId: string) {
        return (product.creatorId == userId);
    }

    async purchaseProduct(productKey: string, userId: string) {
        let params = {
            productKey: productKey,
            userId: userId
        }
        return this.api.create('STPurchasedItem', params);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #calendar                                 */
    /* -------------------------------------------------------------------------- */
    
    // async getPageDataWithPageAsync(page: NPPage): Promise<NPPageData | undefined> {
    //     return new Promise(async (resolve, reject) => {
    //         _flog(this.getPageDataWithPageAsync, arguments);

    //         // // 이미 추가된 경우 즉시 resolve
    //         // if (this.dayItemData[`${year}-${month}-${day}`]) {
    //         //     _log('_createMarkerWithPage already exists =>', page);
    //         //     return resolve(false);
    //         // }

    //         let maxRetries = 10;
    //         for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    //             let pageData: NPPageData | undefined = this.getPageData(page._key);
    //             if (pageData && pageData.date) {
    //                 return resolve(pageData);
    //             }
    //             _log(`_createMarkerWithPage pageData is not ready, retrying... (${retryCount + 1}/${maxRetries})`, page);
    //             await CFHelper.fn.wait(10);
    //         }
    //         console.warn('_createMarkerWithPage: Max retries reached for page =>', page);
    //         resolve(undefined); // 최대 재시도 후 실패 시 resolve(false)
    //     });
    // }

  
}

//
// NPSvg
//

// interface Props {
//     resourceKey: string,
//     width: number,
//     height: number
// }
// interface State {
//     data: any
// }

// export class NPSvg extends React.Component<Props, State> {
//     constructor(props) {
//         super(props)
//         this.state = {
//             data: null
//         }
//         this.loadSvg();
//     }

//     async loadSvg() {
//         let data = await CFNoteAPI.getInstance().getResourceData(this.props.resourceKey);
//         _log('NPSvg::loadSvg data =>', data);
//         _valid(data != null, 345);
//         this.setState({data: data});
//     }

//     render() {
//         return (
//             <View style={[styles.container]}>
//             {
//                 this.state.data &&
//                 <SvgXml
//                     width={this.props.width}
//                     height={this.props.height}
//                     xml={this.state.data}/>
//             }
//             </View>
//         );
//     }
// }

// const styles = StyleSheet.create({
//     container: {
//         //flex: 1,
//         //backgroundColor: 'green'
//     },
// });

