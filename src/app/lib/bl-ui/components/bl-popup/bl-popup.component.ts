import { Component, ContentChild, ElementRef, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLScrollContainer } from '../../directive/bl-scroll-container';
import { BLViewComponent } from '../bl-view/bl-view.component';

export enum PopupDirection {
    up = 'up',
    down = 'down'
}

export enum PopupAlign {
    left = 'left',
    center = 'center',
    right = 'right'
}

@Component({
    selector: 'bl-popup',
    templateUrl: './bl-popup.component.html',
    styleUrls: ['./bl-popup.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLPopupComponent)}]
})
export class BLPopupComponent extends BLViewComponent {
    // prop
    @Input() public title: string = '';
    // position
    @Input() public top: number = 0;
    @Input() public bottom: number = 0;
    @Input() public left: number = 0;
    @Input() public width: number = 0;
    @Input() public height: number = 0; // 쓰지 않는 값 같은데
    @Input() public isMobileViewMode: boolean = false;

    // option
    @Input() public useBottomSheetContainerInMobile: boolean = true;
    @Input() public set initVisible(value: boolean) {
        this.isShow = value;
        this._style = {};
        setTimeout(() => {
            setTimeout(()=> {
                if (value) {
                    this.initCoord();
                }
            },1000);
    
        }, 10)
    }
    
    @Input() style: any = {};

    @ContentChild(TemplateRef) popupBody!: TemplateRef<any>;
 // static 
    public static isClickedMe: boolean = false;

    private static _popups: any = [];
    private static activePopup?: BLPopupComponent;
    public isShow: boolean = false;

    public _style: any = {};
    
    // mobile
    public isShowContainer: boolean = false;
    public isShowBackground: boolean = false;
    
    constructor(
        public renderer: Renderer2, // mobile
        public elRef: ElementRef // mobile
    ) {
        super();
        BLPopupComponent._popups.push(this);
    }

    override blOnInit() {
        console.log('BLPopupComponent::ngAfterViewInit children =>', this.children);
        console.log('BLPopupComponent:: blOnInit isShow =>', this.isShow);
        this.initCoord(); 
    }

    override blOnDestory() {
        let that = this;
        BLPopupComponent._popups =  BLPopupComponent._popups.filter((val: BLPopupComponent) => {
            return val !== that;
        })
    }

    initCoord() {
        _log('initCoord style =>', this.style);
        // set width
        this._style = this.style;
        if (this.width) {
            this._style['width'] = this.width + 'px';
        }
        // if (this.height) {
        //     this.style['height'] = this.height + 'px';
        // }
        if (this.left) {
            this._style['left'] = this.left + 'px';
        }
        if (this.top) {
            this._style['top'] = this.top + 'px';
        }
        if (this.bottom) {
            this._style['bottom'] = this.bottom + 'px';
        }
        _log('blOnInit style =>', this._style);
    }

    // public show() {
    //     this.isShow = true;
    // }

    // public hide() {
    //     this.isShow = false;
    // }

    getGuessMenuHeight() {
        return 100;
    }

    // 메뉴를 띄울때 
    public popup(direction: PopupDirection = PopupDirection.down, 
        align: PopupAlign = PopupAlign.center, 
        targetRect?: any, deltaX: number = 0, deltaY: number = 0) {         
        if(this.isMobileViewMode && this.useBottomSheetContainerInMobile) {
            _log('BLPopupComponent::popup mobile')
            this._popup_mobile();
        } else {
            _log('BLPopupComponent::popup desktop')
            // !! 임시 높이 계산의 하는데 만약에 @Input으로 값을 받아서 사용한다면 
            // 이 계산보다 값 sync가 느려서 반영이 안됨
            // 일단은 timeout에 둠
            setTimeout(() => {
                // 화면에 보이기 전까지는 메뉴의 실제 높이를 안수 없어서 받아야 한다. 안그럼 깜박임
                this.style = {};
                this._calcPopupPosition(direction, align, targetRect, deltaX, deltaY);
                this.isShow = true;
        
                BLPopupComponent.activePopup = this;
                setTimeout(() => {
                    BLPopupComponent.activePopup = undefined;
                },100);
                
                BLScrollContainer.enableAllScroll(false);
            },1);
        }
        // override
        this.afterPopup();
    }

    _popup_mobile() {
        // this.isShow = true;
        this.isShowContainer = true;
        this.isShowBackground = true;
        this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'hidden');
        this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', '100vh');
    }

    protected afterPopup() {

    }

    private _calcPopupPosition(direction: PopupDirection = PopupDirection.down, 
        align: PopupAlign = PopupAlign.center, 
        targetRect?: any, deltaX: number = 0, deltaY: number = 0) {
        _log('_calcPopupPosition targetRect, align =>', targetRect, align);

        let menuHeight = this.getGuessMenuHeight();

        if(targetRect) {
            if (targetRect.top + targetRect.height + menuHeight > window.innerHeight) {
                direction = PopupDirection.up;
            }
            if(direction == PopupDirection.down) {
                this.top = Math.round(targetRect.top + targetRect.height + deltaY);
            } else if(direction == PopupDirection.up) {
                this.top =Math.round(targetRect.top - menuHeight + deltaY);
            }

            if (align == PopupAlign.left) {
                this.left = Math.round(targetRect.left + deltaX);
            } if (align == PopupAlign.center) {
                this.left = Math.round(targetRect.left + (targetRect.width - this.width) / 2 + deltaX);
            } if (align == PopupAlign.right) {
                this.left = Math.round(targetRect.left + targetRect.width - this.width + deltaX);
            }
        } else {
            this.top = 0;
            this.left = 0;
        }

        _log('_calcPopupPosition top, left =>', this.top, this.left);

        this.initCoord();
        // this.style['top'] = this.top + 'px';
        // this.style['left'] = this.left + 'px';
        // this.style['width'] = this.width + 'px';
    }

    // 메뉴가 떠있으면 닫고 닫혀 있으면 뜨고
    public toggle(direction: PopupDirection = PopupDirection.down, 
        align: PopupAlign = PopupAlign.center, 
        targetRect?: any, deltaX: number = 0, deltaY: number = 0) {
        if(this.isShow) {
            this.hide();
        } else {
            this.popup(direction, align, targetRect, deltaX, deltaY);
        }
    }

    // 메뉴를 닫을 때
    public hide() {
        if(this.isMobileViewMode) {
            this._hide_mobile();
        } else {
            this.isShow = false;
            BLPopupComponent.hideAll();
        }
    }

    _hide_mobile() {
        this.isShowBackground = false;
        setTimeout(() => {
            this.isShowContainer = false;
            this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'visible');
            this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', 'auto');
        }, 310);
    }

    onClickMe() {
        _log('BLPopupComponent::onClickMe');
        BLPopupComponent.isClickedMe = true;
        setTimeout(() => {
            BLPopupComponent.isClickedMe = false;
        }, 100);
    }

    public static hideAll() {
        if (BLPopupComponent.isClickedMe) { return; }
        
        // 전에 팝업을 닫을 때 스크롤을 활성화 한다.
        BLScrollContainer.enableAllScroll(true);

        // 나는 스크롤이 안되게 하고 나를 제외한 나머지는 팝업창을 닫는다.
        for(let popup of BLPopupComponent._popups) {
            if(BLPopupComponent.activePopup !== popup) {
                popup.isShow = false;
            } else {
                BLScrollContainer.enableAllScroll(false);        
            }
        }
    }



}
