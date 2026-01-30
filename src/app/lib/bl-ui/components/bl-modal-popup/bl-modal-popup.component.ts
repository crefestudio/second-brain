import { Component, ContentChild, ElementRef, EventEmitter, Input, OnInit, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-modal-popup',
    templateUrl: './bl-modal-popup.component.html',
    styleUrls: ['./bl-modal-popup.component.css']
})
export class BLModalPopupComponent implements OnInit {
    public isShowContainer: boolean = false;
    public isShowBackground: boolean = false;

    // @Input () title: string = '';
    // @Input () rigthBtn: boolean = false;

    // @Output () clickRightBtn = new EventEmitter();
    @Output () close = new EventEmitter();
    
    @ContentChild('modalPopupBody') modalPopupBody!: TemplateRef<any>;

    public isShow: boolean = false;

    protected _resolve: any;
    protected _rejects: any;

    constructor(
        private renderer: Renderer2,
        private elRef: ElementRef
    ) {

    }

    ngOnInit(): void {
    }

    public popup() {
        this.isShow = true;
        this.isShowContainer = true;
        this.isShowBackground = true;
        this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'hidden');
        // this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', '100vh');

        return new Promise((resolve, rejects) => {
            this._resolve = resolve;
            this._rejects = rejects;
        });
    }

    public hide(isRejectedByCloseBtn: boolean = true) {
        _log('BLModalPopupComponent::hide()')
        this.isShow = false;
        this.isShowBackground = false;
        // setTimeout(() => {
            this.isShowContainer = false;
            this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'hidden');
            // this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', '100vh');
        // }, 310);
        if(this.close) {
            this.close.emit();
        }

        if (this._rejects && isRejectedByCloseBtn) {
            this._rejects({});
            this._rejects = null;
        }
    }
}
