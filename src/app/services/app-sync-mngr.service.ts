import { Injectable } from '@angular/core'; 
import { AppEvent } from 'src/_note-platform/note-platform.config';
import { BLNotesService } from './bl-notes.service';
import { AppSyncStore } from '../stores/app-sync.store';
import { _flog, _log, _slog, _valid } from 'src/lib/cf-common/cf-common';
import { NPNote } from 'src/lib/fb-noteapi/cf-noteapi';
import { CFEventsService } from './cf-event.service';

export class AppSyncMngr {
    private _interval: any;
    private _intervalSec: number = 10; // 10초
    constructor(
        public userId: string,
        public events: CFEventsService,
        public notes: BLNotesService,
        public syncStore: AppSyncStore
    ) {
        this._initEvent();
    }

    localDate: any = {
        'note.created': 0
    }

    private _initEvent() {
        // this.events.on(AppEvent.note.created, () => {
        //     _valid(this.userId);
        //     // 여기에 노트 생성 시간을 기록한다.
        //     this.syncStore.updateUpdateDate(this.userId, AppEvent.note.created).then((doc: any) => {
        //         this.localDate[AppEvent.note.created] = doc[AppEvent.note.created];
        //         _log('AppSyncMngr::AppEvent.note.created date =>', this.localDate[AppEvent.note.created]);
        //     });
        // });
    }

    public startSync() {
        _flog(this.startSync, arguments);

        // // restart
        // if (this._interval) { clearTimeout(this._interval); }

        // this._interval = setInterval(() => {
        //     this._doSyncProc();            
        // }, this._intervalSec * 1000);
    }

    public stopSync() {
        if (this._interval) { clearTimeout(this._interval); }
    }
   
    private async _doSyncProc() {
        // note.created
        // let serverTime = await this.syncStore.getUpdateDate(this.userId);

        // // AppEvent.note.created
        // if (serverTime['note.created']) {
        //     if (this.isNeedUpdate(this.localDate['note.created'], serverTime['note.created'])) {
        //         this.events.fire(AppEvent.note.created);
        //     }
        // }

    }

    isNeedUpdate(localTime: any, serverTime: any) {
        const dateLocalTime: any = localTime? new Date(localTime) : new Date();
        const dateServerTime: any = new Date(serverTime);
        return dateLocalTime < dateServerTime;
    }

        // const dateLocalNote: any = new Date(updateDateLocalNote);
        // const dateServerNote: any = new Date(updateDateServerNote);
        // if (dateLocalNote < dateServerNote) {
        //     _log('sync::_doSyncProc::노트 갱신이 필요함');
        //     syncNote = true;
        // }

}

/*                      
AppSync/userId/note.created.date    =>
note.created
note.trashed
      // 휴지통에 넣기 => 이벤트에서 데이타 변경 안됨 // 
        this.appService.events.on(AppEvent.note.trashed,(note: NPNote) => {
            this.deleteRecentlyNote(note);
        });

note.restoreTrashed

*/

// if (!this.noteItemState) { return; }

        // _log('_doSyncProc page =>', page);
        
        // // get loacal time
        // let updateDateLocalPage = this.noteItemState.page.updateDate;       
        // let updateDateLocalNote = this.noteItemState.note.updateDate;

        // // get server time
        // let updateDateServerPage = await this.notes.api.getLastUpdateDateOfPageFromServer(this.noteItemState.noteContent, page);
        // let updateDateServerNote = await this.notes.api.getLastUpdateDateOfNoteFromServer(note, this.appService.userId);

        // if (!updateDateServerPage || !updateDateServerNote) {
        //     this.stopSyncProc();
        //     let pageKey = this.itemState.pageKey;
        //     this.reloadNote(note, pageKey);  
        //     return;
        // }

        // _log('_doSyncProc updateDateLocalNote, updateDateServerNote =>', updateDateLocalNote, updateDateServerNote);
        // _log('_doSyncProc updateDateLocalPage, updateDateServerPage =>', updateDateLocalPage, updateDateServerPage);
        
        // let syncNote: boolean = false;
        // let syncPage: boolean = false;
        // // 노트 시간 변화 체크
        // const dateLocalNote: any = new Date(updateDateLocalNote);
        // const dateServerNote: any = new Date(updateDateServerNote);
        // if (dateLocalNote < dateServerNote) {
        //     _log('_doSyncProc::노트 갱신이 필요함');
        //     syncNote = true;
        // }

        // // 페이지 시간 변화 체크
        // const dateLocalPage: any = new Date(updateDateLocalPage);
        // const dateServerPage: any = new Date(updateDateServerPage);
        // if (dateLocalPage < dateServerPage) {
        //     _log('_doSyncProc::페이지 갱신이 필요함');
        //     syncPage = true;
        // }

        // if (syncNote && !syncPage) {
        //     _log('_doSyncProc::노트 업데이트1 itemState.pageKey =>', this.itemState.pageKey)
        //     // note
        //     this.stopSyncProc();
        //     let pageKey = this.itemState.pageKey;
        //     this.reloadNote(note, pageKey);            
        // } else if (syncPage) {
        //     if (Math.abs(dateServerPage - dateServerNote) <= 1000) {
        //         // page
        //         if (this.noteItemState && this.noteItemState.noteContent) {
        //             _log('_doSyncProc::페이지 업데이트')
        //             this.stopSyncProc();
        //             this.reloadPage(page._key);
        //         }
        //     } else {
        //         _log('_doSyncProc::노트 업데이트2 itemState.pageKey =>', this.itemState.pageKey)
        //         this.stopSyncProc();
        //         let pageKey = this.itemState.pageKey;
        //         this.reloadNote(note, pageKey);   
        //     }
        // }
