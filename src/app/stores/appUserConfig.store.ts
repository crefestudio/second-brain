import { Injectable } from "@angular/core";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { _flog, _log, _valid } from 'src/lib/cf-common/cf-common';
import { NotePlatformService } from '../services/note-platform.service';
import { BLNotesService } from '../services/bl-notes.service';
import { NoticeType } from 'src/lib/fb-noteapi/cf-noteapi';

/*
_key"0gM4VycPaaf2X8CSPxECxawy5JB2"
alwayDesktoViewpInDesktop:false
alwayDesktopViewInInTablet:false
guide
isShowBannerItem:true
isShowGuide:
    add-templates:true
    new-note-note:true
    new-note-page:true
registDate:"2023-10-19T09:09:39.385Z"
updateDate: 2023년 10월 20일 오후 3시 15분 27초 UTC+9 (타임스탬프)
userId: "0gM4VycPaaf2X8CSPxECxawy5JB2"
*/

    // public isNotice: Record<NoticeType, boolean> = {
    //     diary: true,            // 일기 쓰기 알림   // app별로      NPNote에 적게 되면 노트를 늘리면 문제가 됨  user_id : app_id 로 적어야 함       
    //     gift: true,             // 회원 혜택        // app별로
    //     update: true,           // 업데이트 알림    // app별로          
    //     event: true,            // 이벤트           // app별로
    //     operation: true,        // 운영공지         // app별로
    //     product: true           // 새상품           // app별로
    // };



@Injectable()
export class AppUserConfigStore extends AppBaseStore {
    private _config: any = {};
    private _collectionName: string = 'AppConfig'; // 'AppUserCOnfig'로 변경 예정

    private appDefaultAppConfig = {
        isNotice : {
            update: true,           // 업데이트 알림
            diary: true,            // 일기 쓰기 알림
            gift: true,             // 회원 혜택
            event: true,            // 이벤트
            operation: true,        // 운영공지
            product: true           // 새상품
        }
    }
    
    constructor(
        public appService: NotePlatformService,
        private notes: BLNotesService,

    ) {
        super();
    }
    
    async getAppConfig(userId: string, appId: string) {
        // config
        let _config = await this._api.get(this._collectionName, userId);
        this._config = _config;
        _log('getAppConfig _config =>', _config);

        // appConfig
        if (!_config.appConfig) {
            _config.appConfig = {};
        }
        if (!_config.appConfig[appId]) {
            _config.appConfig[appId] = this.appDefaultAppConfig;
            this.updateIsNotice(userId, appId, this.appDefaultAppConfig.isNotice);
        }
        return _config.appConfig[appId];
    }

    async updateIsNotice(userId: string, appId: string, isNotice: Record<NoticeType, boolean>) {
        _flog(this.updateIsNotice, arguments);
        _valid(this._config);
        if (!this._config) { return; }

        if (!this._config.appConfig) {
            this._config.appConfig = {};
        }
        if (!this._config.appConfig[appId]) {
            this._config.appConfig[appId] = this.appDefaultAppConfig;
        }

        this._config.appConfig[appId].isNotice = isNotice;
        await this._api.set(this._collectionName, userId, this._config);

        // update notes

        // 메세지 발송 시 NPNote가져오고 AppConfig를 개인별로 매번 가져오는게 효율이 안나서 발송이 안됨
        // 그래서 NPNote에다 설정값을 캐쉬해줘야 함 
        let productKey = this.appService.appBuildConfig.noteTemplate.productKey; // 이건 페이지템플릿 키가 아니라 페이지템플릿으로 만든 노트의 상품키, 아직 노트템플릿이 없으니 실제 노트 템플릿 상품키가 없음, 그냥 임시로 넣음
        _valid(productKey);
        let notes = await this.notes.api.notesOfMyDownloadedNotes(userId, productKey);
        _log('updateIsNotice notes =>', notes);
        for(let note of notes) {
            note.isNotice = isNotice;
            await this.notes.api.udpateNote(note);
        }
        _log('updateIsNotice2 notes =>', notes);        
    }

    // public isNotice: Record<NoticeType, boolean> = {
    //     update: true,           // 업데이트 알림
    //     diary: true,            // 일기 쓰기 알림
    //     gift: true,             // 회원 혜택
    //     event: true,            // 이벤트
    //     operation: true,        // 운영공지
    //     product: true           // 새상품
    // };
}