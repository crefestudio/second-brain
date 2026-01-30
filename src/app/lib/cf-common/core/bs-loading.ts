// import { Injectable } from '@angular/core';
// //import { Ng4LoadingSpinnerService } from 'ng4-loading-spinner';
// import { NgxSpinnerService } from "ngx-spinner";

// var loadingCount = 0;

// @Injectable()
// export class BSLoadingService {

//     public isLoading: number = 0;

//     //private minTime: number = 500;
//     private maxTime: number = 15000;
//     //private isMinTimeout: boolean = false;

//     constructor(private loading: NgxSpinnerService) {

//     }

//     public start(message = '') {

//         this.isLoading++;
//         loadingCount++;
//         console.log("loadingbar - start count = ", this.isLoading, loadingCount, message);
//         this.loading.show();
//         //this.isMinTimeout = false;

//         // timeout
//         if (this.isLoading == 1) {
//             setTimeout(()=>{
//                 console.log("loadingbar - timeout - hide");
//                 this._hide();
//             }, this.maxTime);
//         }

//         // min check
//         // 최소 min이상은 돌아야 한다.
//         // setTimeout(()=> {
//         //     this.isMinTimeout = true;

//         //     // 최소시간보다 loading이 빨리 끝난경우 여기서 숨겨줌
//         //     if (!this.isLoading) {
//         //         console.log("loadingbar - 최소시간 타임아웃 - 숨김");
//         //         this._hide();
//         //     }
//         // }, this.minTime);

//     }

//     public end(message='') {
//         this.isLoading--;
//         loadingCount--;
//         console.log("loadingbar - end    count = ", this.isLoading, loadingCount,  message);
//         // 최소 시간 이상이어야 숨겨짐
//         if (/*this.isMinTimeout && this.isLoading < 1*/ loadingCount < 1) {
//             console.log("loadingbar - 숨김");
//             this._hide();
//         }
//     }

//     private _hide() {
//         //console.log("loadingbar - _hide() - 숨김 ", this.isLoading);
//         this.loading.hide();
//         this.isLoading = 0;
//     }

//     ////////////////////////////////////////////////////////////////////////////////

//     // start와 동일한데 카운트에서 제외된다.
//     public show(message='') {
//         console.log("loadingbar - show = ", this.isLoading, message);
//         this.loading.show();
//         //this.isMinTimeout = false;

//         // timeout
//         setTimeout(()=>{
//             console.log("loadingbar - timeout - hide");
//             this._hide();
//         }, this.maxTime);

//         // min check
//         // 최소 min이상은 돌아야 한다.
//         // setTimeout(()=> {
//         //     //this.isMinTimeout = true;

//         //     // 최소시간보다 loading이 빨리 끝난경우 여기서 숨겨줌
//         //     console.log("loadingbar - 최소시간 타임아웃 - 숨김");
//         //     this._hide();

//         // }, this.minTime);
//     }

//     // end와 동일한데 카운트에서 제외된다.
//     public hide(message='') {
//         console.log("loadingbar - hide    count = ", this.isLoading, message);
//         // 최소 시간 이상이어야 숨겨짐
//         //if (this.isMinTimeout) {
//             console.log("loadingbar - 숨김");
//             this._hide();
//         //}
//     }

// }
