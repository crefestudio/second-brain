import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";

import { CFDate, CFHelper, _log, _valid } from 'src/lib/cf-common/cf-common';
import { environment } from 'src/environments/environment';
import { BLMediaStore } from '../stores/bl-media.store';

@Injectable()
export class FBFileUploaderService {
    constructor(
        public mediaStore: BLMediaStore,
    ) { 
    }

    public async imageUploadByFb(file: any, folderName: string = 'userContent', userId: string, width?: number, height?: number, quality?: number): Promise<string> {
        let resp = this._imageUploadByFbWithProgress(file, folderName, userId, width, height, quality);
        return resp;

        ////////////////////////////////////////////
        // 프로그래스 없이 직접 올리는 코드

        // const app = initializeApp(environment.firebaseConfig);
        // let storage = getStorage(app);
        // let storageRef = ref(storage, `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`);
        // _log('imageUploadByFb::uploadBytes storageRef =>', `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`);
        // let downloadURL: string;
        // let errror: any;
        // try {
        //     await uploadBytes(storageRef, file);
        //     downloadURL = await getDownloadURL(storageRef); 
        //     _log('imageUploadByFb downloadURL =>', downloadURL);
        //     let registDate = CFDate.nowAsString();
        //     this.mediaStore.create(file.name, file.size, file.type, registDate, downloadURL, userId);
        //     // url에서 토크을 제거 한다. 권한문제 때문에 토큰 제거
        //     //return downloadURL;            
        // } catch(_error: any) {
        //     _log('imageUploadByFb:error error =>', _error);
        //     console.error('파일 업로드 및 다운로드 URL 얻기 실패:', _error);
        //     errror = _error;
        //     //throw error;
        // };

        // return new Promise((resolve, reject) => {
        //     if (downloadURL) {
        //         resolve(downloadURL);
        //     } else {
        //         reject(errror);
        //     }
        // });
    }

    private async _imageUploadByFbWithProgress(file: any, folderName: string = 'userContent', userId: string, width?: number, height?: number, quality?: number): Promise<string> {
        const app = initializeApp(environment.firebaseConfig);
        let storage = getStorage(app);
        let filePath = `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`;
        let storageRef = ref(storage, filePath);
        _log('imageUploadByFb::uploadBytes storageRef =>', `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`);
        // let downloadURL: string;
        // let errror: any;
        return new Promise((resolve, reject) => {
            // 안드로이드에서 사진첨부 시(포토앨범) 간헐적으로 업로드 안되는 문제 해결 10ms이상 타이머를 주면 잘 됨
            setTimeout(() => {
                const uploadTask = uploadBytesResumable(storageRef, file);
                uploadTask.on('state_changed', (snapshot) => {
                    // Observe state change events such as progress, pause, and resume
                    // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    _log('imageUploadByFb2::Upload is ' + progress + '% done');
                    switch (snapshot.state) {
                    case 'paused':
                        _log('imageUploadByFb2::Upload is paused');
                        break;
                    case 'running':
                        _log('imageUploadByFb2::Upload is running');
                        break;
                    }
                }, (error) => {
                    _log('imageUploadByFb2::error.code =>', error.code);
                    switch (error.code) {
                        case 'storage/unauthorized':
                        // User doesn't have permission to access the object
                        _log('imageUploadByFb2::Upload unauthorized');
                        break;
                        case 'storage/canceled':
                            _log('imageUploadByFb2::Upload canceled');
                        // User canceled the upload
                        break;
                
                        // ...
                
                        case 'storage/unknown':
                        // Unknown error occurred, inspect error.serverResponse
                        _log('imageUploadByFb2::error.serverResponse =>', error.serverResponse);
                        break;
                    }
                    reject(error);
                    throw error;
                }, () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        _log('imageUploadByFb2::File available at', downloadURL);
                        _log('imageUploadByFb2::업로드한 파일의 다운로드 file:', file);
                        let registDate = CFDate.nowAsString();
                        this.mediaStore.create(filePath, file.name, file.size, file.type, registDate, downloadURL, userId);
                        resolve(downloadURL);
                    });            
                });
            }, 50);

       
            // if (downloadURL) {
            //     resolve(downloadURL);
            // } else {
            //     reject(errror);
            // }
        });
    }    

    // public imageUploadByFb2(file: any, folderName: string = 'userContent', userId: string, width?: number, height?: number, quality?: number) {
    //     const app = initializeApp(environment.firebaseConfig);
    //     let storage = getStorage(app);
    //     let storageRef = ref(storage, `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`);
    //     _log('imageUploadByFb2::uploadBytes storageRef =>', `${folderName}/${userId}/images/${CFHelper.id.generateIdDateType()}_${file.name}`);
    //     const uploadTask = uploadBytesResumable(storageRef, file);

    //     // Register three observers:
    //     // 1. 'state_changed' observer, called any time the state changes
    //     // 2. Error observer, called on failure
    //     // 3. Completion observer, called on successful completion
    //     uploadTask.on('state_changed', 
    //     (snapshot) => {
    //         // Observe state change events such as progress, pause, and resume
    //         // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
    //         const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    //         console.log('imageUploadByFb2::Upload is ' + progress + '% done');
    //         switch (snapshot.state) {
    //         case 'paused':
    //             console.log('imageUploadByFb2::Upload is paused');
    //             break;
    //         case 'running':
    //             console.log('imageUploadByFb2::Upload is running');
    //             break;
    //         }
    //     }, 
    //     (error) => {
    //         console.log('imageUploadByFb2::error.code =>', error.code);
    //         switch (error.code) {
    //             case 'storage/unauthorized':
    //               // User doesn't have permission to access the object
    //               console.log('imageUploadByFb2::Upload unauthorized');
    //               break;
    //             case 'storage/canceled':
    //                 console.log('imageUploadByFb2::Upload canceled');
    //               // User canceled the upload
    //               break;
          
    //             // ...
          
    //             case 'storage/unknown':
    //               // Unknown error occurred, inspect error.serverResponse
    //               console.log('imageUploadByFb2::error.serverResponse =>', error.serverResponse);
    //               break;
    //         }
    //         throw error;
    //     }, 
    //     () => {
    //         // Handle successful uploads on complete
    //         // For instance, get the download URL: https://firebasestorage.googleapis.com/...
    //         getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
    //             console.log('imageUploadByFb2::File available at', downloadURL);
    //             console.log('imageUploadByFb2::업로드한 파일의 다운로드 file:', file);
    //             let registDate = CFDate.nowAsString();
    //             this.mediaStore.create(file.name, file.size, file.type, registDate, downloadURL, userId);
    //         });            
    //     }
    //     );
    // }

    

}

