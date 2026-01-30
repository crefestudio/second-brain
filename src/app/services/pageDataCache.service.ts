import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { _flog, _log, _valid, CFHelper } from 'src/lib/cf-common/cf-common';

import { NPNote, NPNoteContent, NPPage, NPPageData } from 'src/lib/fb-noteapi/cf-noteapi';
import { BLNotesService } from './bl-notes.service';
import { NotePlatformService } from './note-platform.service';
import { AppCommand } from '../note-platform.config';

@Injectable()
export class PageDataCacheService {
    constructor(
        private notes: BLNotesService,
        private appService: NotePlatformService
    ) {

    }

    private noteContent?: NPNoteContent;

    init(noteContent: NPNoteContent) {
        this.noteContent = noteContent;
        this.clearPageDataCache();
    }

    /* -------------------------------------------------------------------------- */
    /*                               #pagaData cache                              */
    /* -------------------------------------------------------------------------- */
    public pageData: Record<string, NPPageData | boolean> = {};   // key : pageKey : data or true (로딩중)
    public clearPageDataCache() {
        this.pageData = {};
    }

    invalidatePage(page: NPPage) {
        _flog(this.invalidatePage, arguments);
        _valid(page);
        if (!page) { return; }
        delete this.pageData[`${page._key}`];
    }

    invalidatePageWithPageKey(pageKey: string) {
        delete this.pageData[`${pageKey}`];
    }

    // public removePageData(pageKey: string) {
    //     delete this.pageData[`${pageKey}`];
    // }

    public setLoadStatePageData(pageKey: string) {
        this.pageData[`${pageKey}`] = true
    }

    public setPageData(pageKey: string, data: NPPageData) {
        this.pageData[`${pageKey}`] = data;
    }

    public getPageData(pageKey: string): NPPageData | undefined {
        if (!this.pageData) { return undefined; }

        // 데이타가 있고 로딩중이 아니면
        if (!this.pageData[`${pageKey}`]) {
            // 데이타가 없음 - 로딩중
            this.pageData[`${pageKey}`] = true;
            this._loadPageData(pageKey);
        } else if (this.pageData[`${pageKey}`] === true) {
            return undefined;
        }
        return this.pageData[`${pageKey}`] as NPPageData; 
    }

    // 데이타를 가져올때까지 10회 시도해서 있으면 준다.
    public async safeGetPageDataWithPage(page: NPPage): Promise<NPPageData | undefined> {
        return new Promise(async (resolve, reject) => {
            _flog(this.safeGetPageDataWithPage, arguments);

            let maxRetries = 20; // 로딩 시도 회수 
            for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
                let pageData: NPPageData | undefined = this.getPageData(page._key);
                if (pageData && pageData.date) {
                    return resolve(pageData);
                }
                _log(`safeGetPageDataWithPage pageData is not ready, retrying... (${retryCount + 1}/${maxRetries})`, page._key, page.date, page, pageData);
                await CFHelper.fn.wait(50);
            }
            console.warn('safeGetPageDataWithPage Max retries reached for page =>', page);
            resolve(undefined); // 최대 재시도 후 실패 시 resolve(false)
        });
    }    

    // // 로그 남기면 안되는 부분 -> 계속 호출됨
    // // 날짜로 페이지 정보 얻기
    private async _loadPageData(pageKey: string) {
        _flog(this._loadPageData, arguments);
        _valid(this.noteContent);
        _valid(this.appService.userId);
        
        if (!this.noteContent) {
            _log('loadPageData noteContent =>', this.noteContent);
            //this._isDoneLoadPageData[`${page._key}`] = false; 
            this.invalidatePageWithPageKey(pageKey);
            return;
        }

        // 여기서 page에 object없으면 채운다.
        let page: NPPage | undefined = this.notes.api.getPageFromNoteContent(this.noteContent, pageKey);
        if (!page) {
            this.setLoadStatePageData(pageKey); // 이미 페이지가 삭제된 경우
            return;
        }
        let data: NPPageData = await this.notes.api.getDataOfPage(page, this.appService.userId);

        // 날짜 보정 
        // 날짜는 있는데 page.date는 없는 경우
        // if (data.date && !page.date) {
        //     page.date = data.date;
        //     this.appService.sendCommand(AppCommand.page.update.date, page); ////////////////////////////////////
        //     _log('loadPageData::page.date 보정 page.date =>', page.date);
        //     // 위에 값 저장하는데 비동기 
        //     // 달력은 별도값을 사용하니 별도 invalidate, 그럼 지도는?
        //     setTimeout(() => {
        //         _valid(this.pagesCalendarContainer);
        //         this.pagesCalendarContainer.invalidate();
        //     }, 1000);
        //     return;
        // }

        // set page data
        this.setPageData(pageKey, data);
        _log('loadPageData pageKey, page, pageData[pageKey] =>', pageKey, page, this.pageData[`${pageKey}`])
    }

}