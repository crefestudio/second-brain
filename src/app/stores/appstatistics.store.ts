// import { Injectable } from "@angular/core";
// import { collection } from "firebase/firestore/lite";
// import { _log } from "src/lib/cf-common/cf-common";
// import { AppBaseStore } from 'src/_note-platform/services/store.service';


// @Injectable()
// export class AppStatisticsStore extends AppBaseStore {

//     // async create(appIstanceKey: string, userId: string) {
//     //     let session = {
//     //         appKey: appIstanceKey,
//     //         userId: userId,
//     //     }
//     //     return this._api.create('AppUserSession', session, appIstanceKey);
//     // }

//     async getGuestLogin() {
//         return this._api.get('AppStatistics', 'guestLogin');
//     }

//     async createGuestLogin() {
//         let guestLogined: any = await this.getGuestLogin(); 
//         _log('createGuestLogined res =>',  guestLogined, parseInt(guestLogined.count));
//         let _count = parseInt(guestLogined.count);
//         let count = _count ? _count : 0;
//         return this._api.create('AppStatistics', { count: count + 1 }, 'guestLogin');
//     }

//     // async getSignupPopup() {
//     //     return this._api.get('App', 'signupPopup');
//     // }
// }