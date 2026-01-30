// ////////////////////////////////////////////////////////////////////
// //  BSFileUploader
// //  Ver 0.001

// import { Injectable } from '@angular/core';
// import { initializeApp } from 'firebase/app';
// import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

// import { CFDate, _log, _valid } from '../cf-common';
// import { environment } from 'src/environments/environment';
// import { BLMediaStore } from 'src/_note-platform/stores/bl-media.store';

// @Injectable()
// export class BSFileUploader {
//     constructor(
//         public mediaStore: BLMediaStore,
//     ) { 
//         //this.api = new BSApi(_http, _alert);
//     }

//     /*
//         media/image/저장할 폴더이름
//             이미지로 인식되서 리사이즈 기능 지원
//             thumbnail resize기능

//         media/file/저장할 폴더이름
//     */

//     // private uploadFileApiUrl: string = 'media/file';
//     // private uploadImageApiUrl: string = 'media/image';
//     //private folderName: string = 'default';

//     /*
//     let thumbnailData = [
//         {width: 1000 , height: 750},  // large, 미사용
//         {width: 450 , height: 450 },  // view
//         {width: 335 , height: 335 },  // list1
//         {width: 270 , height: 270 },  // list2
//         {width: 82 , height: 115 },   // thumbView, 미사용
//         {width: 90 , height: 90 },    // thumbCart
//         {width: 60 , height: 84 },    // thumbScroll, 미사용
//         {width: 150 , height: 150 },  // mobileMain
//         //{width: 335 , height: 470 },// thumbProgram, 미사용
//       ]
//     */

//     /*
//       quality : 어떤값을 줘야 하는지 모르겠음
//     */

//     // public imageUpload(file: any, folderName: string = 'default', width?: number, height?: number, quality?: number) {
//     //     _valid(file);     
//     //     let formData:FormData = new FormData();
//     //     formData.append('file', file);
//     //     if(width && height) {
//     //         formData.append('size[width]', width.toString());
//     //         formData.append('size[height]', height.toString());
//     //     }
//     //     if (quality) {
//     //         formData.append('size[quality]', quality.toString());
//     //     }
        
//     //     // formdata는 콘솔에서 확인이 안됨 
//     //     console.log("imageUpload file =>", file);
//     //     return this.api.postWithFormBody(this.uploadImageApiUrl + '/' + folderName, formData);
//     // }

//     public imageUploadByFb(file: any, folderName: string = 'userContent', userId: string, width?: number, height?: number, quality?: number) {
//         const app = initializeApp(environment.firebaseConfig);
//         let storage = getStorage(app);
//         let storageRef = ref(storage, `${folderName}/${userId}/images/${file.name}`);
//         return uploadBytes(storageRef, file).then(() => getDownloadURL(storageRef))
//         .then(downloadURL => {
//             console.log('업로드한 파일의 다운로드 file:', file);
//             let registDate = CFDate.nowAsString();
//             this.mediaStore.create(file.name, file.size, file.type, registDate, downloadURL, userId);
//             return downloadURL;
//         })
//         .catch(error => {
//             console.error('파일 업로드 및 다운로드 URL 얻기 실패:', error);
//             throw error;
//         });
//     }

//     // 
//     //  아직 미사용이라 포팅을 하지 않았음
//     //
//     // public imageUploadForMultiSize(event, folderName?, thumbnailData?) {

//     //     if (folderName) {
//     //         this.folderName = folderName;
//     //     }
//     //     //let subject : Subject<any> = new Subject<any>();

//     //     let fileList: FileList = event.target.files;
//     //     if(fileList.length < 1) {
//     //     //   return;
//     //     }

//     //     let file: File =  fileList[0];
//     //     let formData:FormData = new FormData();


//     //     formData.append('file', fileList[0]);

//     //     if(thumbnailData) {
//     //         let i = 0;
//     //         for(let image of thumbnailData) {
//     //             let widthStr = 'thumbnail_size[' + i + '][width]';
//     //             let heightStr = 'thumbnail_size[' + i + '][height]';
//     //             let quality = 'thumbnail_size[' + i + '][quality]';
//     //             formData.append(widthStr, image.width);
//     //             formData.append(heightStr, image.height);
//     //             formData.append(quality, image.quality);
//     //             i++;
//     //         }
//     //     }

//     //     console.log("formdata =", formData);

//     //     let headers = new Headers();
//     //     console.log(headers);
//     //     //headers.append('Content-Type', 'multipart/form-data');
//     //     headers.append('Accept', 'application/json');
//     //     headers.append('enctype', 'multipart/form-data');

//     //     let options = new RequestOptions({ headers: headers });
//     //     return this.api.post2(this.uploadImageApiUrl + '/' + this.folderName, formData, options);
//     // }

//     // public removeImage(image) {
//     //     return this.api.delete(this.uploadImageApiUrl + '/' + this.folderName + '/' + image);
//     // }


//     //
//     //  아직 미사용이라 포팅하지 않음
//     //

//     // public fileUpload(event, uploadUrl?, folderName?) {

//     //     if (uploadUrl) {
//     //         this.uploadFileApiUrl = uploadUrl;
//     //     }

//     //     if (folderName) {
//     //         this.folderName = folderName;
//     //     }

//     //     //let subject : Subject<any> = new Subject<any>();
//     //     console.log(event);

//     //     let fileList: FileList = event.target.files;
//     //     if(fileList.length < 1) {
//     //     //   return;
//     //     }

//     //     let file: File =  fileList[0];
//     //     return this.upload(file);
//     // }

//     // public upload(file, uploadUrl?) {
//     //     let formData:FormData = new FormData();
//     //     formData.append('file', file);

//     //     console.log("file =", file);
//     //     console.log("formdata =", formData);

//     //     let url;
//     //     if (uploadUrl) {
//     //         url = uploadUrl;
//     //     } else {
//     //         // media/file /default
//     //         url = this.uploadFileApiUrl + '/' + this.folderName;
//     //     }

//     //     let headers = new Headers();
//     //     //headers.append('Content-Type', 'multipart/form-data');
//     //     headers.append('Accept', 'application/json');
//     //     headers.append('enctype', 'multipart/form-data');

//     //     let options = new RequestOptions({ headers: headers , withCredentials: true });
//     //     console.log('BSFileUploader::upload url =>', url);
//     //     return this.api.post2(url, formData, options);
//     // }
// }
