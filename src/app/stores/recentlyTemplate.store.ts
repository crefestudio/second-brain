// import { Injectable } from "@angular/core";
// import { _flog, _log, _valid } from "src/lib/cf-common/cf-common";
// import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
// import { NPPageTemplate, NPSticker } from "src/lib/fb-noteapi/cf-noteapi";
// import { AppBaseStore } from 'src/_note-platform/services/store.service';
// import { NotePlatformService } from '../services/note-platform.service';


// @Injectable()
// export class RecentlyTemplateStore extends AppBaseStore {
//     private static _isCreating: boolean = false;

//     constructor(
//         private appService: NotePlatformService,
//     ) {
//         super();
//     }

//     async create(template: NPPageTemplate, userId: string) {
//         if (RecentlyTemplateStore._isCreating == true) { return; } // transaction
//         RecentlyTemplateStore._isCreating = true; // transaction
        
//         let rcTemplate: any = {
//             _key: template._key, // 중복 방지를 위해서 노트의 키를 사용한다. // 여기는 템플릿의 id를 사용
//             userId: userId,
//             templateKey: template._key,
//             coverImageURI: template.coverImageURI, 
//             name: template.name
//         };

//         let result = await this._api.create('AppRecentlyTemplate', rcTemplate, rcTemplate._key); // 중복 방지를 위해서 키를 지정해서 생성한다.

//         // limit 
//         let limitLength: number = 15;
//         let rcTemplateList = await this.list(userId, false);
//         if(rcTemplateList.length > limitLength) {
//             for(let i = limitLength; i < rcTemplateList.length; i++) {
//                 let overNote = rcTemplateList[i];
//                 await this._api.delete('AppRecentlyTemplate', overNote._key);
//             }
//         }
//         RecentlyTemplateStore._isCreating = false; // transaction
        
//         _log('RecentlyTemplateStore::create rcTemplate =>', rcTemplate);
//         return result;
//     }

//     async list(userId: string, useCache: boolean = true) {
//         return this._api.listByFilter('AppRecentlyTemplate', {userId: `${userId}`}, false, useCache, useCache, 'updateDate', FBOrderDirection.desc, 100);
//     }
    
//     // async delete
//     async delete(template: any) {
//         _flog(this.delete, arguments);
//         _valid(template._key);
//         let resp;
//         let item = await this._api.get('AppRecentlyTemplate', template._key); 
//         _log('recentlyTemplateStore delete item => ', item);
//         if(item) {
//             resp = await this._api.delete('AppRecentlyTemplate', template._key);
//         }
//         return resp;
//     }
// }