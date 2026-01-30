import { Injectable } from '@angular/core';


// import 'rxjs/add/operator/map';
// import { Subject } from 'rxjs';
import { BLAlertComponent } from '../components/bl-alert/bl-alert.component';
import { BLErrorComponent } from '../components/bl-error/bl-error.comopnent';
import { BLToastComponent } from '../components/bl-toast/bl-toast.comopnent';

@Injectable()
export class BLAlertService {

    private blAlertlRef!: BLAlertComponent;
    private blToastRef!: BLToastComponent;
    private blErrorRef!: BLErrorComponent;

    constructor() {
    }

    public init(alertComponent: BLAlertComponent, toast: BLToastComponent, error: BLErrorComponent) {
        this.blAlertlRef = alertComponent;
        this.blToastRef = toast;
        this.blErrorRef = error
        console.log('blAlertService init this.blAlertlRef, alertComponent =>', this.blAlertlRef, alertComponent);
    }

    public show(message='', title='',  okBtnText = '확인') {
        // const subject = new Subject<any>();
        console.log('blAlertService show this.blAlertlRef =>', this.blAlertlRef);
        return this.blAlertlRef.show(message, title, okBtnText);
    }

    // isFeedbackCloseBtn : close버튼을 눌러도 cancel과 동일하게 reject로 보기
    public confirm(message='', title = '확인', okBtnText = '확인', cancelBtnText = '취소', isRejectedByCloseBtn:boolean = true) {
        return this.blAlertlRef.confirm(message, title, okBtnText, cancelBtnText, isRejectedByCloseBtn);
    }

    public toast(message = '') {
        this.blToastRef.show(message);
    }

    public error(message: string, isShowErrorMessage: boolean) {
        this.blErrorRef?.show(message, isShowErrorMessage);
    }

}
