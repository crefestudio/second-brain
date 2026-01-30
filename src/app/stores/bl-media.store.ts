import { Injectable } from "@angular/core";
import { _flog, _log, BLGPS } from "src/lib/cf-common/cf-common";
import { AppBaseStore } from '../services/store.service';
import { initializeApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FBFunctionsRegion } from '../services/fb-functions.service'; 
import { FBOrderDirection } from 'src/lib/fb-noteapi/cf-fb-store-api';

export interface BLMedia {
    _key: string;
    name: string;
    size: number;
    type: string;
    registDate: string;
    downloadURL: string;  // 이 값이 key로 작용한다.
    userId: string;

    // 추가 정보
    gps?: BLGPS;
    imageWidth?: number;
    imageHeight?: number;
    dateTaken?: string;
}

@Injectable()
export class BLMediaStore extends AppBaseStore {

    constructor(

    ) {
        super();
    }

    async create(filePath: string, fileName: string, size: string, type: string, registDate: string, downloadURL: string, userId: string) {
        let blMedia: BLMedia = {
            _key: '', // create될때 생김
            name: fileName,
            size: parseInt(size),
            type: type,
            registDate: registDate,
            downloadURL: downloadURL,  // 이 값이 key로 작용한다.
            userId: userId
        }

        let doc = await this._api.create('BLMedia', blMedia);
        _log('BLMediaStore::create doc =>', doc);
        return await this._updateImageMetadata(filePath, doc._key);
    }

    private async _updateImageMetadata(filePath: string, mediaDocKey: string) {
        _flog(this._updateImageMetadata, arguments);

        const app = initializeApp(environment.firebaseConfig);
        const functions = getFunctions(app, FBFunctionsRegion);
        const func_updateImageMetadata = httpsCallable(functions, 'updateImageMetadata');

        let result;
        try {
            let resp = await func_updateImageMetadata({
                filePath: filePath,
                mediaDocKey: mediaDocKey
            });
            result = (resp.data) as any;
            _log('_updateImageMetadata result =>', result);
        } catch (e) {

        }
        return result;
    }

    async getPdfs(userId: string) {
        let resp = await this._api.listByFilter('BLMedia', { type: 'application/pdf', userId: userId }, false, false, false, 'registDate', FBOrderDirection.desc);
        _log('getMedia resp =>', resp);
        return resp;
    }


    async getMedia(downloadURL: string, userId: string): Promise<BLMedia> {
        let resp = await this._api.getByFilter('BLMedia', { downloadURL: downloadURL, userId: userId });
        _log('getMedia resp =>', resp);
        return resp;
    }

}