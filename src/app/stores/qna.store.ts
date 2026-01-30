import { Injectable } from "@angular/core";
import { _log } from "src/lib/cf-common/cf-common";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { AppBaseStore } from 'src/_note-platform/services/store.service';

export interface AppQnaEntity {
    appId: string;
    email: string;
    category: string;          
    contents: string;
    userId?: string;
    //public registDate: CFDate.nowAsString()
};

@Injectable()
export class QnaStore extends AppBaseStore {

    constructor() {
        super();
    }
    
    async create(entity: AppQnaEntity) {
        _log('QnaStore create entity =>', entity);
        return this._api.create('AppQna', entity); 
    }
    
    async list(useCache: boolean = true) {
        return this._api.listByFilter('AppQna', {}, false, useCache, useCache, 'updateDate', FBOrderDirection.desc, 100);
    }
}