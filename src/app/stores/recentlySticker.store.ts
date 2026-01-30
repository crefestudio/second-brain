import { Injectable } from "@angular/core";
import { _flog, _log, _valid } from "src/lib/cf-common/cf-common";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { NPItemType, NPSticker } from "src/lib/fb-noteapi/cf-noteapi";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { NotePlatformService } from '../services/note-platform.service';
import { AppBuildConfig } from 'src/_app-build-configs/app.build-config';


@Injectable()
export class RecentlyStickerStore extends AppBaseStore {
    private static _isCreating: boolean = false;

    constructor(
        private appService: NotePlatformService,
    ) {
        super();
    }
    

    async create(sticker: NPSticker, userId: string, appId: string) {
        if (RecentlyStickerStore._isCreating == true) { return; } // transaction
        RecentlyStickerStore._isCreating = true; // transaction
        
        let rcSticker: any = {
            _key: sticker._key,
            userId: userId,
            appId: appId,
            stickerKey: sticker._key,
            imageURI: sticker.imageURI
        };

        let result = await this._api.create('AppRecentlySticker', rcSticker, rcSticker._key); // 중복 방지를 위해서 키를 지정해서 생성한다.

        //limit
        let rcStikcerList = await this.list(userId, AppBuildConfig.app.id, false);
        let limitLength: number = 15;
        if(rcStikcerList.length > limitLength) {
            for(let i = limitLength; i < rcStikcerList.length; i++) {
                let overNote = rcStikcerList[i];
                await this._api.delete('AppRecentlySticker', overNote._key);
            }
        }
        
        RecentlyStickerStore._isCreating = false; // transaction
        return result;
    }

    async list(userId: string, appId: string = '', useCache: boolean = true) {
        let filter: any =  { userId: `${userId}` };
        // appId필터 추가
        if (appId && appId.length > 0) {
            filter['appId'] = appId;
        }
        return this._api.listByFilter('AppRecentlySticker', filter, false, useCache, useCache, 'updateDate', FBOrderDirection.desc, 100);
    }
    
    async delete(sticker: any) {
        _flog(this.delete, arguments);
        _valid(sticker._key);
        _log('store:AppRecentlySticker delete =>', sticker);
        let resp;
        let item = await this._api.get('AppRecentlySticker', sticker._key); 
        if(item) {
            resp = await this._api.delete('AppRecentlySticker', sticker._key);
        }
        return resp;
    }
}