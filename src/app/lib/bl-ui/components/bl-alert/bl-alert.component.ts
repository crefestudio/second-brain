import { Component, ElementRef, Input, Renderer2 } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { rejects } from 'assert';
import { resolve } from 'dns';
import { BLDialogPopupComponent } from '../bl-dialog-popup/bl-dialog-popup.component';

@Component({
    selector: 'bl-alert',
    templateUrl: './bl-alert.component.html',
    styleUrls: ['./bl-alert.component.css']
})
export class BLAlertComponent extends BLDialogPopupComponent {
    isPopuping: boolean = false;
    @Input() set message(value: string) {
        this._message = this.sanitizer.bypassSecurityTrustHtml(value);
    };
    get message() {
        return this._message;
    }
    public _message: any = '';

    constructor(
        renderer: Renderer2,
        elRef: ElementRef,
        private sanitizer: DomSanitizer,
    ) {
        super(renderer, elRef);
    }

    public show(message='', title='',  okBtnText = '확인'): Promise<any> {
        this.isPopuping = true;
        setTimeout(() => {
            this.isPopuping = false;
        }, 100)
        this.message = message;
        this.title = title;
        this.btnOkText = okBtnText;
        this.btnCancelText = '';
        this.popup();
        return new Promise((resolve, rejects) => {
            this._resolve = resolve;
        });
    }

    public confirm(message='', title='',  okBtnText = '확인', cancelBtnText = '취소', isRejectedByCloseBtn:boolean = true): Promise<any> {
        this.message = message;
        this.title = title;
        this.btnOkText = okBtnText;
        this.btnCancelText =  cancelBtnText;
        this.isRejectedByCloseBtn = isRejectedByCloseBtn;
        return this.popup();
        // return new Promise((resolve, rejects) => {
        //     this._resolve = resolve;
        //     this._rejects = rejects;
        // });
    }

    // 팝업을 하기 위해 배경을 터치 했는데 그 터치가 배경터치로 바로 먹어서 창뜨자마자 창이 닫히는 버그 수정
    onClickBackground2() {
        if (!this.isPopuping) {
            this.onClose();
        }
    }
}
