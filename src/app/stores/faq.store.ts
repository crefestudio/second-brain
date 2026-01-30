import { Injectable } from "@angular/core";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { AppBaseStore } from 'src/_note-platform/services/store.service';


@Injectable()
export class FaqStore extends AppBaseStore {
    constructor() {
        super();
    }
    // async create(params: any) {
    //     return this._api.create('AppFaq', params); 
    // }

    async list(useCache: boolean = true) {
        return this._api.listByFilter('AppFaq', {}, false, useCache, useCache, 'seq', FBOrderDirection.desc, 100);
    }
}