import { Component, ContentChild, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-bottom-sheet',
    templateUrl: './bl-bottom-sheet.component.html',
    styleUrls: ['./bl-bottom-sheet.component.css']
})
export class BLBottomSheetComponent implements OnInit {
    public isShowBody: boolean = false;
    public isHiddenBody: boolean = true;

    public isShowBackground: boolean = false;
    public disableAnimationTemp: boolean = false;    // 임시로 animation을 끔
    public enableAnimation: boolean = true;

    @Input() title: string = '';
    //@Input() backgroundColor: string = 'rgba(20, 12, 14, 0.4)';
    @Input() hasHeader: boolean = true;
    @Input() isModalPopup: boolean = true;
    @Input() theme: string = 'light';

    @Input() isLeftMode: boolean = false;
    @Input() insetTop: number = 0;

    @Output () clickRightBtn = new EventEmitter();
    @Output () close = new EventEmitter();
    
    @ContentChild('bottomSheetBody') bottomSheetBody!: TemplateRef<any>;

    public isShow: boolean = false;

    public isClose: boolean = false;

    constructor(
        private renderer: Renderer2,
        private elRef: ElementRef
    ) {

    }

    ngOnInit(): void {
    }

    @HostListener("wheel", ["$event"])
    public onScroll(event: WheelEvent) {
        event.stopPropagation();
    }

    public popup(isModalPopup: boolean = true, enableAnimation: boolean = true, delay = 100) {      
        this.isClose = false;
        this.enableAnimation = enableAnimation;

        this.isModalPopup = isModalPopup;
        this.disableAnimationTemp = false;
        
        this.isShowBody = true;    // 우선 body를 보인다.
        this.isHiddenBody = true;  // 컨테이너를 로딩하는 동안 안보이게 함

        this.isShowBackground = false;   
        
        this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'hidden');
        this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', '100vh');

        // 숨겨서 우선 보이게 하고 다음에 해당 component가 로딩되고 그 다음에 화면에 에니메이션을 시작한다.
        setTimeout(() => {
            this.isHiddenBody = false;
            this.isShowBackground = true; // container를 active하고 이때 css로 애니메이션이 시작 된다.
        }, delay)

        // 애니메이션이 끝나면, modal이 아니면 끔, 임시로, display: none에 보일경우 animation이 되어버림, 다른 패널에 덥혔다가 나타날때 animation 되어 버림
        setTimeout(() => {
            if (!isModalPopup) {
                this.disableAnimationTemp = true;
            }
        }, 700);

    }

    public hide(enableAnimation: boolean = true, isClose: boolean = false) {
        this.enableAnimation = enableAnimation;
        let _oldIsShow = this.isShowBackground;
        _log('BLBottomSheetComponent::hide enableAnimation =>', enableAnimation);
        this.disableAnimationTemp = false;
        this.isShowBackground = false;
        setTimeout(() => {
            this.isShowBody = false;
            this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'overflow', 'visible');
            this.renderer.setStyle(this.elRef.nativeElement.parentElement, 'height', 'auto');
        }, 310);
    
        // 원래부터 닫혀있다면 event를 안보내는게 맞다. 안그럼 안열린 상태에서도 hide()호출하면 닫힘 이벤트가 와서 버그 생겼음
        if (_oldIsShow) {
            if(this.close) {
                this.close.emit();
            }
        }

        // 애니메이션이 끝나면
        setTimeout(() => {
            if (!this.isModalPopup) {
                this.isShowBody = false;
                this.disableAnimationTemp = true;
                this.isClose = isClose;   
            }
        }, 700);

    }

    public isPopup() {
        return this.isShowBody;
    }

    public isModal() {
        return this.isModalPopup;
    }

    _clickRightBtn() {
        if(this.clickRightBtn) {
            this.clickRightBtn.emit();
        }
    }
}
