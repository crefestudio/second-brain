import { Component, forwardRef, Input } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../bl-view/bl-view.component';

export enum BLItemState {
    normal = 'normal',
    selected = 'selected',
    activated = 'activated'
}

@Component({
    selector: 'bl-grid-item',
    templateUrl: './bl-grid-item.view.html',
    styleUrls: ['./bl-grid-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLGridItemView)}]
})
export class BLGridItemView extends BLViewComponent {
    @Input() item: any;
    @Input() itemState: BLItemState = BLItemState.normal;

    @Input() width: number = 94;
    @Input() height: number = 94;
    @Input() gridColumn: string = '';       // 직접 그리드 시작 / 끝 값을 넣어줌 '2/4'
    @Input() isLineItem: boolean = false;   // 한줄짜리 아이템인지 여부
    @Input() hasMenuBtn: boolean = true;   // 팝업메뉴 갖고 있는지 여부
    @Input() hasDateBox: boolean = true;   // 업데이트 날짜 
    @Input() hasTitleBox: boolean = true;   // 제목 (스티커용이였음.)
    @Input() isShadow: boolean = true;
    public isModal: boolean = false;

    constructor(
    ) {
        super();
    }

    override blOnInit() {

    }

    // setModal(isModal: boolean = true) {
    //     this.isModal = isModal;
    //     _log('===============================>');

    //     // alert('modal // ' + this.isModal);
    //     this.alertService.confirm('내용 내용 내용 내용', '타이틀', '확인버튼', '취소버튼');
    //     this._setModal();
    // }

    // _setModal() {
    //     console.log('setmodal =>',  this.template.elementRef);
    //     // this.renderer.setStyle(this.containerEl.nativeElement, 'overflow', 'hidden');
    //     // this.renderer.setStyle(this.containerEl.nativeElement, 'height', '100vh');
    // }
    
    // _resetModal() {
    //     // this.renderer.setStyle(this.containerEl.nativeElement, 'overflow', 'scroll');
    // }
}
