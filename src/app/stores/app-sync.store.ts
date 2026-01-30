import { Injectable } from "@angular/core";
import { serverTimestamp } from "firebase/firestore/lite";
import { AppBaseStore } from 'src/_note-platform/services/store.service';


@Injectable()
export class AppSyncStore extends AppBaseStore {
    constructor() {
        super();
    }

    // session 
    async createSession(appSessionKey: string, userId: string) {
        let session = {
            appKey: appSessionKey,
            userId: userId,
        }
        return this._api.create('AppUserSession', session, appSessionKey);
    }

    async getSessionCount(userId: string) {
        return this._api.getByFilter('AppUserSession', { userId: userId });     // 시간 필터링
    }

    // sync 
    async getUpdateDate(userId: string) {
        return this._api.get('AppSync', userId);
    }

    async updateUpdateDate(userId: string, actionId: string) {
        let params: any = {};
        params[actionId] = serverTimestamp(); // 현재 시간
        this._api.update('AppSync', userId, params);
    }
}