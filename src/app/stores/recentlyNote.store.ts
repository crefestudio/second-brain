import { Injectable } from "@angular/core";
import { CFHelper, _flog, _log, _valid } from "src/lib/cf-common/cf-common";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { NPNote } from "src/lib/fb-noteapi/cf-noteapi";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { NotePlatformService } from '../services/note-platform.service';


@Injectable()
export class RecentlyNoteStore extends AppBaseStore {
    private static _isCreating: boolean = false;

    constructor(
        private appService: NotePlatformService,
    ) {
        super();
    }

    async create(note: NPNote) {
        if (RecentlyNoteStore._isCreating == true) { return; } // transaction
        RecentlyNoteStore._isCreating = true; // transaction
        let userId = this.appService.userId;                
        let rcNote: any = {
            _key: note._key, // 중복 방지를 위해서 노트의 키를 사용한다.
            userId: userId,
            noteKey: note._key
        };
        _log('RecentlyNoteStore create() rcNote =>', rcNote);
        // 없으면 만들고, 있으면 그냥 덮어쓰고
        let result = await this._api.create('AppRecentlyOpenedNote', rcNote, rcNote._key); // 중복 방지를 위해서 키를 지정해서 생성한다.

        // 개수 제한 : 개수 제한은 추가 후 진행 함 
        let rcNoteList = await this._api.listByFilter('AppRecentlyOpenedNote', {userId: `${userId}`}, false, false, false, 'updateDate', FBOrderDirection.desc, 100); // 역순, 소트해서 리스트 가져와야 함
        let limitLength: number = 15;
        if(rcNoteList.length > limitLength) {
            for(let i = limitLength; i < rcNoteList.length; i++) {
                let overNote = rcNoteList[i];
                await this._api.delete('AppRecentlyOpenedNote', overNote._key);
            }
        }
        
        RecentlyNoteStore._isCreating = false; // transaction
        return result;
    }

    async get(note: NPNote, userId: string) {
        return this._api.getByFilter('AppRecentlyOpenedNote', {userId: userId, noteKey: note._key});
    }

    async list(userId: string, useCache: boolean = true) {
        return this._api.listByFilter('AppRecentlyOpenedNote', {userId: `${userId}`}, false, useCache, useCache, 'updateDate', FBOrderDirection.desc, 100); // 소팅 필드 지정 필요함 : updateDate
    }
    
    // async delete
    async delete(rcNote: any) {
        _flog(this.delete, arguments);
        _valid(rcNote._key);
        let resp;
        let item = await this._api.get('AppRecentlyOpenedNote', rcNote._key); 
        _log('recentlyNoteStore delete item => ', item);
        if(item) {
            resp = await this._api.delete('AppRecentlyOpenedNote', rcNote._key);
        }
        return resp;
    }
}