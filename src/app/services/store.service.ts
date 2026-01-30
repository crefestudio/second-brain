import { environment } from '../../environments/environment';
// firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore/lite';
import { CFFBStoreAPI } from 'src/lib/fb-noteapi/cf-fb-store-api';
import { CFHelper } from 'src/lib/cf-common/cf-common';

export class AppEntity {
    constructor(
        public _key: string = CFHelper.id.generateUUID()
    ) {
    }
}

export class AppBaseStore {
    protected _api: CFFBStoreAPI;
    
    constructor(
        protected _entityName: string = ''
    ) {
        let app = initializeApp(environment.firebaseConfig);
        const db2 = getFirestore(app, environment.fireStoreDB);
        //const db = firebase.database();
        this._api = CFFBStoreAPI.getInstance(db2);
    }

    // async create(entitiy: AppEntity) {
    //     return this._api.create(this._entitiyName, entitiy);
    // }

    // async get(key: string) {
    //     return this._api.get(this._entitiyName, key);
    // }
}