import { Injectable } from "@angular/core";
import { _log } from "src/lib/cf-common/cf-common";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { NotePlatformService } from '../services/note-platform.service';
import { environment } from 'src/environments/environment';

export interface AppLog {
    appId: string;
    message: string;
    userId?: string;
};

@Injectable()
export class AppLogStore extends AppBaseStore {

    constructor() {
        super();
    }
    
    async log(userId: string, ...args: any[]) {
        const message = args.map(arg => String(arg)).join(' ');
        const entity: AppLog = {
            appId: environment.appId,
            message: message,
            userId: userId
        };
        _log('AppLogStore::create entity =>', entity);
        return this._api.create('AppLog', entity); 
    }
}