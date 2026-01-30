// //import 'rxjs/add/operator/map';
// // import { Subject, throwError } from 'rxjs';
// // import { Observable } from 'rxjs';

// //import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// //import { Http, Response, Request, RequestOptions, Headers, URLSearchParams } from "@angular/http";

// // import 'rxjs/add/observable/throw';
// // import 'rxjs/add/operator/map';
// // import 'rxjs/add/operator/do';  // debug
// // import 'rxjs/add/operator/catch';
// import { catchError, filter, map, tap } from 'rxjs/operators';

// //import { BSLoadingService } from './bs-loading';
// import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service'; 

// import { environment } from 'src/environments/environment'; 
// import { _log } from '../cf-common';

// export interface BSBaseUrl {
//     baseUrl?: any;
//     enabled?: boolean;
//     type?: any;
// }

// export class FormQueryEncoder {
//     encodeKey(k: string): string { return encodeURIComponent(k); }
//     encodeValue(v: string): string { return encodeURIComponent(v); }
// }

// //@Injectable()
// export class BSApi {
//     static url: string = environment.apiURL;
//     static cachableUrl: string = ''; //environment.cachableApiURL;

//     //private defaultRequestOption: any = { withCredentials: true };

//     constructor(public _http: HttpClient,
//         //private loading: BSLoadingService,
//         private alert: BLAlertService) {

//     }

//     private _errorHandler(err: any, ignoreErrorAlert: boolean = false) {
//         // this.loading.end();

//         // setTimeout(()=> {
//         //     this.loading.end();
//         // }, 1000);
//         // setTimeout(()=> {
//         //     this.loading.end();
//         // }, 2000);

//         let _err = err; //err.json();

//         // 네트워크 미연결
//         if (!_err || !_err.code) {
//             console.log('_errorHandler', _err);
//             return new Error(_err);
//         }

//         if (ignoreErrorAlert === true) {
//             return new Error(_err);
//         }

//         console.log("_errorHandler _err =>", _err);     
//         _err.message = _err.message.toString().replace('\n', '<br/>');

//         // _todo : 프로덕트모드에서만 alert 패스하는것으로 수정필요
//         // if (_err.error.code == 500) {

//         // } else {
//             if (this.alert) {
//                 this.alert.show(_err.message, '알림').then(() => {


//                     // if (_err.error.status == 403 || _err.error.status == 404) {
//                     //     this.location.back();
//                     // }
//                 });
//                 //this.alert.show(_err.message + ' <br>CODE = '  + _err.code, '알림');
//             } else {
//                 alert(_err.message + ' CODE = '  + _err.code);
//             }
//         //}

//         return new Error(_err);

//         // //this.loading.end();

//         // console.log('bsapi::_errorHandler sever error:', err);  // debug
//         // if(err instanceof Response) {
//         //   return Observable.throw(err.json().error || 'backend server error');
//         //   // if you're using lite-server, use the following line
//         //   // instead of the line above:
//         //   //return Observable.throw(err.text() || 'backend server error');
//         // }
//         // return Observable.throw(err || 'backend server error');
//     }

//     _respProcess(res: any) {
//         //this.loading.end('api:done');
//         _log('_respProcess res =>', res);
//         let _res = res;//res.json();
//         if(_res.error) {
//             throw _res;
//         }
//         return _res;
//     }

//     // todo : 로딩바 api 오류일때 숨기기 // 위치를 잡을 수 있어
//     get(endpoint: string, params?: any, header?: HttpHeaders, 
//             ignoreErrorAlert: boolean = false, cachable: boolean = false) {
//         // todo: 임시로 세션을 로딩에서 제외함, 이것때문에 로딩회수가 꼬여서 카트에 로딩이 안나옴
//         // this.loading.start(endpoint);

//         if (!header) {
//             header = new HttpHeaders();
//         }

//         // Support easy query params for GET requests
//         let options = { search: {}, header: header,  params: params, withCredentials: true };
//         // if (params) {
//         //     const p = new URLSearchParams('');
//         //     for (const key in params) {
//         //         p.set(key, params[key]);
//         //     }
//         //     // Set the search field if we have params and don't already have
//         //     // a search field set in options.
//         //     options.search = !options.search && p || options.search;
//         // }

//         let url = (cachable ? BSApi.cachableUrl : BSApi.url) + '/' + endpoint;
//         console.log("BSApi:get options, url =>", options, url);
//         url = encodeURI(url);
//         console.log("BSApi:get url =>", url);

//         return this._http.get(url, options).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );        
//     }

//     post(endpoint: string, body: any, header?: HttpHeaders, ignoreErrorAlert: boolean = false) {
//         //this.loading.start();

//         return this._http.post(/*BSApi.url + '/' +*/ endpoint, body, { headers: header, withCredentials: true }).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }

//     // 파일 업로드 할 때 사용함
//     postWithForm(endpoint: string, bodyObject: any, ignoreErrorAlert: boolean = false, headers?: any) {
//         //this.loading.start();

//         // make body
//         let body:URLSearchParams = new URLSearchParams();
//         Object.keys(bodyObject).map(key => {
//            body.append(key, bodyObject[key]); 
//         });

//         // header
//         if (!headers) {
//             headers = new HttpHeaders();
//             headers.append('Content-Type', 'application/x-www-form-urlencoded');
//             headers.append('enctype', 'multipart/form-data');  
//             headers.append('Accept', 'application/json');
//         }

//         console.log('api postWithForm endpoint, bodyObject =>', endpoint, bodyObject);
//         return this._http.post(BSApi.url + '/' + endpoint, body, { headers: headers, withCredentials: true }).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }

//     postWithFormBody(endpoint: string, body: any, ignoreErrorAlert: boolean = false, headers?: any) {
//         //this.loading.start('post2 '+ endpoint);
//         return this._http.post(BSApi.url + '/' + endpoint, body,{ headers: headers, withCredentials: true }).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }

//     put(endpoint: string, body: any, headers?: HttpHeaders, ignoreErrorAlert: boolean = false, 
//         ignoreProgress: boolean = false) {

//         // if (!ignoreProgress) {
//         //     this.loading.start();
//         // }

//         console.log('put ', BSApi.url + '/' + endpoint, body);

//         return this._http.put(BSApi.url + '/' + endpoint, body, { headers: headers, withCredentials: true }).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }

//     delete(endpoint: string, params?: any, headers?: HttpHeaders, ignoreErrorAlert: boolean = false) {

//         //this.loading.start();

//         if (params && !headers) {
//             headers = new HttpHeaders({
//                 body: params
//                 });
//         } else if (!headers) {
//             headers = new HttpHeaders({
//                 });
//         }

//         return this._http.delete(BSApi.url + '/' + endpoint, {headers: headers, withCredentials: true}).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }

//     patch(endpoint: string, body: any, headers?: HttpHeaders, ignoreErrorAlert: boolean = false) {

//         //this.loading.start();

//         return this._http.put(BSApi.url + '/' + endpoint, body, { headers: headers, withCredentials: true }).pipe(
//             map(res => { return this._respProcess(res); }),
//             tap(data => { console.log('bsapi::get cmd / mtsc =>', endpoint , data);}),
//             catchError(err => { throw this._errorHandler(err, ignoreErrorAlert); })
//         );
//     }
// }

