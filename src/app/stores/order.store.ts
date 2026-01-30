import { Injectable } from "@angular/core";
import { AppBaseStore } from 'src/_note-platform/services/store.service';


@Injectable()
export class OrderStore extends AppBaseStore {
    constructor() {
        super();
    }
    
    async create(params: any) {
        return this._api.create('STOrder', params); 
    }
}