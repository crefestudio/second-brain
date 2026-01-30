// import { Injectable } from "@angular/core";
// import { _valid } from "src/lib/cf-common/cf-common";
// import { AppBaseStore, AppEntity } from "src/_note-platform/services/store.service"

// export class AppMyStore extends AppEntity {
//     public userId: string = '';
//     public storeName: string = '';
//     public tags: Array<string> = [];
//     public backgroundImage: string = 'assets/images/ex.png';
//     public storeProfileImage: string = '';
//     public storeDesc: string = '';
//     public storeNotice: string = '';
//     public storeLikeTotal: number = 0;
//     public wishTotal: number = 0;
//     public storePorductTotal: number = 0;
//     // sns 
//     public instagram: string = '';
//     public youtube: string = '';
//     public facebook: string = '';
//     public website: string = '';

//     constructor() {
//         super();
//     }
// }

// @Injectable()
// export class MyStoreStore extends AppBaseStore { 
//     constructor() {
//         super('AppMyStore');
//     }

//     // 새로운 entity 생성
//     // entity 안에 키가 있으면, 저장시 키가 바뀌는 문제가 생김.
//     async create(entitiy: AppEntity) {
//         _valid(!entitiy._key);
//         return this._api.create(this._entityName, entitiy);
//     }

//     async get(storeKey: string) {
//         return this._api.getByFilter(this._entityName,  {_key: storeKey});
//     }

//     async getByUserId(userId: string) {
//         return this._api.getByFilter(this._entityName,  {userId: userId});
//     }

//     // 데이터 전체를 변환
//     async set(key: string, entitiy: AppEntity) {
//         return this._api.set(this._entityName, key, entitiy);
//     }

//     // 데이터 일부를 변환
//     async update(key: string, params: any) {
//         return this._api.update(this._entityName, key, params);
//     }
// }