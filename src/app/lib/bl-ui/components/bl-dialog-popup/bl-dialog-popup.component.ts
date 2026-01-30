import { Component, ContentChild, ElementRef, EventEmitter, Input, OnInit, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { BLModalPopupComponent } from '../bl-modal-popup/bl-modal-popup.component';

@Component({
    selector: 'bl-dialog-popup',
    templateUrl: './bl-dialog-popup.component.html',
    styleUrls: ['./bl-dialog-popup.component.css']
})
export class BLDialogPopupComponent extends BLModalPopupComponent {

    public isRejectedByCloseBtn: boolean = true; // x나 배경 눌러서 닫을 때 reject보내기 여부

    // @Input() maxWidth: string = '312px';
    @Input() title: string = '';
    @Input() closeable: boolean = true; // 취소버튼 노출 없애고 취소 버튼을 눌러도 닫히지 않게
    @Input() isNotCloseOnOk: boolean = false;
    @Input() isTooltip: boolean = false;
    @Input() tooltipDesc: string = '';
    @Input() isShowHeader: boolean = true;
    @Input() bkColorOfOkBtn: string = '#4179D9'; //'#3d98f3';
    @Input() isShowPremiumIcon: boolean = false;

    @Input() width: number = 312;

    @Input() isBottomBtn: boolean = true;
    @Input() btnOkText: string = 'Ok';
    @Input() btnCancelText: string = '';
    @Input() backgroundColor?: string;

    @ContentChild('dialogPopupBody') dialogPopupBody!: TemplateRef<any>;

    constructor(
        renderer: Renderer2,
        elRef: ElementRef
    ) {
        super(renderer, elRef);
    }

    public override popup(): Promise<any> {
        this.isShow = true;
        return super.popup();
    }

    onCancel() {
        this.isShow = false;
        // if (this._rejects) {
        //     this._rejects({});
        //     this._rejects = null;
        // }
        this.hideDialog();
    }

    onClose() {
        this.hideDialog(this.isRejectedByCloseBtn);
    }

    onOk() {
        if (this.isNotCloseOnOk) { return; }
        this.isShow = false;

        if (this._resolve) {
            this._resolve({});
            this._resolve = null;
        }
        this._rejects = null;
        this.hideDialog();
    }

    onClickBackground() {
        this.hideDialog();
    }

    hideDialog(isRejectedByCloseBtn: boolean = true) {
        if(this.closeable) {
            this.hide(isRejectedByCloseBtn);
        }
    }
}