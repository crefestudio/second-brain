import { Injectable } from '@angular/core';
//import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

import { CFHelper, _flog, _log, _valid } from 'src/lib/cf-common/cf-common';

// firebase
import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore } from 'firebase/firestore/lite';

import { CFNoteAPI, INPImage, NPAuth, NPImageType } from 'src/lib/fb-noteapi/cf-noteapi'; 
//import { CFFBAPI } from 'src/lib/fb-noteapi/cf-fbapi';
import { CFNoteHistory } from 'src/lib/fb-noteapi/cf-note-history';

// firebase store
import { CFFBStoreAPI } from 'src/lib/fb-noteapi/cf-fb-store-api';
//import { AppService } from '../common/services/app.service';

@Injectable()
export class BLNotesService {
    public api: CFNoteAPI;
    //public fbApi: CFFBAPI;
    public fbStoreApi: CFFBStoreAPI;
    public history: CFNoteHistory;
    public app: any;
    constructor() {
        this.app = initializeApp(environment.firebaseConfig); //
        //const db = firebase.database();
        //this.fbApi = CFFBAPI.getInstance(db);
        
        const db2 = getFirestore(this.app, environment.fireStoreDB);
        _log('_fbstoreTest() db ===========> ', db2); 
        this.fbStoreApi = CFFBStoreAPI.getInstance(db2);

        this.api = CFNoteAPI.getInstance(db2, this.app);
        this.history = new CFNoteHistory(this.api);

        this._fbstoreTest();        
    }
    
    async _fbstoreTest() {
        // const testCollectionRef = collection(db, 'test');
        // _log('_fbstoreTest() testCollectionRef ===========> ', testCollectionRef); 
        // await addDoc(testCollectionRef, {test: 'true'});
        // const api = CFNoteAPI.getInstance(db, this.app);
        // _log('_fbstoreTest() api ===========> ', api);
        
        // let resp = await this.fbStoreApi.create('test3', { 
        //     a: 1, 
        //     b:2,
        //     objects: [
        //         { a: 1, b: 1, title: 'title'},
        //         { a: 1, b: 1, title: 'title'},
        //     ], 
        //     registDate: ' ' 
        // });
        //let data = await this.fbStoreApi.getByFilter('test', {a: 1});
        //let data = await this.fbStoreApi.update('test', 'DEfY3cuS6fxg4zBtZIkX' , {a: 44, updateDate: '  '});
        //await this.fbStoreApi.delete('test', 'DPLNkpDds7sOtW40Wwe2');
        //NPPageTemplate/${template._key}/objects/${objectIndex}
        //let resp = await this.fbStoreApi.updateByNode('objects/59FQMlOMrii6E5I0Rr9g/pages/0', {a: 333});
        //_log('_fbstoreTest resp =>', resp);
       
        // let resp = await this.fbStoreApi.listByCollection('NPPageTemplate/JEvYy9qAa3T6A8cgD3G0/objects');
        // _log('_fbstoreTest resp =>', resp);

        //get('NPPageTemplate', 'JEvYy9qAa3T6A8cgD3G0', 'objects')    // objects collection의 array를 붙인다.

        //this.fbStoreApi.deleteCollection('NPPageTemplate/tLPXrM4TVDSAAtwUEbRf/objects')
    }
    /* -------------------------------------------------------------------------- */
    /*                                  #resource                                 */
    /* -------------------------------------------------------------------------- */
    // async getResourceData(resURI: string) {
    //     _log('getResourceData resURI =>', resURI);
    //     // data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBo…lIi8+DQo8L2NsaXBQYXRoPg0KPC9kZWZzPg0KPC9zdmc+DQo=
    //     return this.api.getResourceData(resURI);
    // }

    // 처음에는 svg나 이미지나 모두 url로 통합 변환했는데 svg를 url로 바꾸면 내부에 외부 이미지 링크가 안보이는 문제로 이 함수를 사용 못함
    // useSvgUrl 
    //      : true -> 내부에 다른 이미지 url이 없이 순수 SVG인 경우 
    //      : false -> 내부에 다른 이미지 url이 있는 경우    
    // [ imageUrl, svgData ]
    async getResourceDataUrl(resURI: string, byUrl: boolean = false): Promise<Array<string>> {
        let image: INPImage = await this.api.parseURI(resURI);
        _log('getResourceDataUrl resURI, image =>', resURI, image);
        let imageUrl: string = '', svgData: string = '';
        if (image.type == 'svg') {
            let svg = CFHelper.svg.changeSizeInSvgString(image.data);
            svg = CFHelper.svg.fixSvgImageUrl(svg);
            if (byUrl) {
                imageUrl = CFHelper.svg.svgStringToDataUrl(svg);
            } else {
                svgData = svg;    // 이미지 안에 외부 링크 이미지가 있으면 표시가 안되는 문제 떄문에 이렇게 했는데 그럼 또 basic_memo 가 안보여서 
            }
        } else {
            imageUrl = resURI;
        }
        _log('getResourceDataUrl imageUrl, svgData =>', imageUrl, svgData);
        return [imageUrl, svgData];
    }

    async getSvgDataFromImageURI(resURI: string, userId: string): Promise<string> {
        let image: INPImage = this.api._parseURIExceptData(resURI);
        if (image.type !== 'svg') { return ''; }
        let imgData: any = await this.api.getResourceData(resURI, userId);
        //_log('getResourceDataUrl imgData =>', imgData);
        let svg = CFHelper.svg.changeSizeInSvgString(imgData);
        svg = CFHelper.svg.fixSvgImageUrl(svg);
        return svg;
    }

    async getImage(resURI: string): Promise<INPImage> {
        if (!_valid(resURI != null && resURI.length > 0)) return {type: NPImageType.undefined, data: '', uri: resURI, userId: '', auth: ''} ;
        return await this.api.parseURI(resURI);
    }

    async getPublicThumbImageUrl(url: string): Promise<string> {
        _flog(this.getPublicThumbImageUrl, arguments);
        // thumbUrl을 만듦
        const suffix = '200x200';
        const lastDotIndex = url.lastIndexOf('.');
        if (lastDotIndex === -1) { return ''; }

        let _thumbUrl: string = url.split('?')[0];   // 뒤에 토큰 제거하고 새로 토큰을 요청한다. 
        const name = _thumbUrl.substring(0, lastDotIndex); // 파일명 (확장자 제외)
        const extension = _thumbUrl.substring(lastDotIndex); // 확장자
        
        let thumbUrl = `${name}_${suffix}${extension}`; // 새 파일명으로 설정
        _log('getPublicthumbImageUrl thumbUrl =>', thumbUrl);
        
        let publicUrl = await this.getPublicImageUrl(thumbUrl);
        _log('getPublicThumbImageUrl publicUrl =>', publicUrl);

        // 1회 요청 
        if (!publicUrl || publicUrl.length == 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); 
            publicUrl = await this.getPublicImageUrl(thumbUrl);
            _log('getPublicThumbImageUrl publicUrl =>', publicUrl);
        }

        // 2회 요청 
        if (!publicUrl || publicUrl.length == 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); 
            publicUrl = await this.getPublicImageUrl(thumbUrl);
            _log('getPublicThumbImageUrl publicUrl =>', publicUrl);
        }
        
        // 3회 요청
        if (!publicUrl || publicUrl.length == 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            publicUrl = await this.getPublicImageUrl(thumbUrl);
            _log('getPublicThumbImageUrl publicUrl =>', publicUrl);
        }
        return publicUrl; //this.getPublicImageUrl(thumbUrl);
    }

    async getPublicImageUrl(url: string) {
        return this.fbStoreApi.getPublicImageUrl(url);
    }

    // async removeImageWithURI(resURI: string) {
    //     let image: INPImage = await this.getImage(resURI);
    //     if (image.type == NPImageType.svg) {
    //         await this.api.removeResource(resURI);
    //     } else {
    //         // 여기는 아직 미진행
    //     }
    // }
    
    // async copyImageUrl(imageFile: string) {

    // }
}