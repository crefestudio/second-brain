import { Injectable } from "@angular/core";
import { _flog, _log } from "src/lib/cf-common/cf-common";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { initializeApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { NotePlatformService } from '../services/note-platform.service';
import { NPNoteContent, NPPage, NPPageHeart } from 'src/lib/fb-noteapi/cf-noteapi';
import { FBFunctionsService, FBFunctionsRegion } from '../services/fb-functions.service';

@Injectable()
export class FeedDisplayStore extends AppBaseStore {
    constructor(
        //private appService: NotePlatformService,
        private fbFuncService: FBFunctionsService
    ) {
        super();
    }

    async listPublicPageOfNote(appId: string, lastDocKey: string = '', limit = 5) {
        _flog(this.listPublicPageOfNote);

        const app = initializeApp(environment.firebaseConfig);
        const functions = getFunctions(app, FBFunctionsRegion);
        const func_listPublicPageOfNote = httpsCallable(functions, 'listPublicPageOfNote');

        let result;
        try {
            // let resp = await this.fbFuncService.listPublicPageOfNote({
            //     appId: appId,
            //     lastDocKey: lastDocKey,
            //     limit: limit 
            // });

            let resp = await func_listPublicPageOfNote({
                appId: appId,
                lastDocKey: lastDocKey,
                limit: limit
            });
            result = (resp.data) as any;
            _log('listPublicPageOfNote result =>', result);
        } catch (e) {

        }
        return result;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #heart                                   */
    /* -------------------------------------------------------------------------- */

    async toggleHeartPage(noteContentKey: string, pageKey: string, userId: string) {
        let _isHeartPage: boolean = await this.isHeartPage(noteContentKey, pageKey, userId);
        let result;
        let isSet: boolean = false;
        if (_isHeartPage) {
            result = await this.unsetHeartPage(noteContentKey, pageKey, userId);
        } else {
            result = await this.setHeartPage(noteContentKey, pageKey, userId);
            isSet = true;
        }
        let heartCount = await this.getHeartCountOfPage(noteContentKey, pageKey);
        return { heartCount: heartCount, isSet: isSet };
    }

    // 페이지에 공감
    async setHeartPage(noteContentKey: string, pageKey: string, userId: string) {

        let pageHeart = new NPPageHeart(noteContentKey, pageKey, userId);
        return this._api.set('NPPageHeart', pageHeart._key, pageHeart);
    }

    // 페이지에 공감 해제
    async unsetHeartPage(noteContentKey: string, pageKey: string, userId: string) {
        try {
            let pageHeart = await this._api.getByFilter('NPPageHeart',
                {
                    noteContentKey: noteContentKey,
                    pageKey: pageKey,
                    userId: userId
                }
            )
            await this._api.delete(`NPPageHeart`, pageHeart._key);
        } catch (e) {
            _log('unsetHeartPage e =>', e);
        }
    }

    async isHeartPage(noteContentKey: string, pageKey: string, loginedUserId: string) {
        _flog(this.isHeartPage, arguments);
        let pageHeart = await this._api.getByFilter('NPPageHeart',
            {
                noteContentKey: noteContentKey,
                pageKey: pageKey,
                userId: loginedUserId
            }
        );
        _log('isHeartPage pageHeart =>', pageHeart);

        let _isHeartPage = false;
        if (pageHeart) _isHeartPage = true;
        return _isHeartPage;
    }

    // 이 페이지에 공감수
    async getHeartCountOfPage(noteContentKey: string, pageKey: string) {
        let heartCount = 0;
        try {
            let pageHearts = await this._api.listByFilter('NPPageHeart',
                {
                    noteContentKey: noteContentKey,
                    pageKey: pageKey
                }
            )
            _log('getHeartCountOfPage pageHearts =>', pageHearts);
            if (pageHearts) {
                heartCount = pageHearts.length;
            }
        } catch (e) {
            _log('getHeartCountOfPage e =>', e);
        }
        return heartCount;
    }

}