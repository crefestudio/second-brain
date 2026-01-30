import { Component, ElementRef, forwardRef, Input, Renderer2, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLPopupComponent, PopupAlign, PopupDirection } from '../bl-popup/bl-popup.component';
import { BLBaseMenuItemComponent } from './items/bl-base-menu-item/bl-base-menu-item.component';

export interface IBLMenuPopupEventParams {
    menuId: string;
    
    // option
    forcePopup?: boolean,   // 이미 메뉴가 떠 있어도 그냥 강제로 닫고 띄움, 마우스 우클릭 시 context메뉴 띄울 때 사용
    
    // postion
    rect?: any,         // 팝업 뜨는 위치
    deltaX?: number,    // 팝업 뜨는 위치 보정
    deltaY?: number,    // 팝업 뜨는 위치 보정    
    align?: PopupAlign,
    direction?: PopupDirection,

    // params
    item?: any,
    extParam?: any
}

export enum MenuPopupType {
    list = 'list',
    grid = 'grid'
}

@Component({
    selector: 'bl-menu-popup',
    templateUrl: './bl-menu-popup.component.html',
    styleUrls: ['./bl-menu-popup.component.css'],
    providers: [{ provide: BLPopupComponent, useExisting: forwardRef(() => BLMenuPopupComponent)}]
})
export class BLMenuPopupComponent extends BLPopupComponent {
    @ViewChild('blPopup') blPopup!: ElementRef;
    @Input() type: string = MenuPopupType.list;
    @Input() isShowHotKey: boolean = true;
    @Input() itemHeight: number = 35;

    public isOver: boolean = false;
    
    constructor(
        renderer: Renderer2, // mobile
        elRef: ElementRef // mobile
        ) {
        super(renderer, elRef);
    }
        
    override blOnInit() {
        for(let view of this.children) {
            let menuItem = view as BLBaseMenuItemComponent;
            menuItem.type = this.type;
            menuItem.isShowHotKey = this.isShowHotKey;
            menuItem.itemHeight = this.itemHeight;
        }
    }

    protected override afterPopup() {
        // 메뉴가 뜰 때 메뉴아이템에게 알려준다. 
        for(let view of this.children) {
            let menuItem = view as BLBaseMenuItemComponent;
            menuItem.blInitMenuItem();
        }
    }

    override getGuessMenuHeight() {
        let height = 0;
        let margin = 4;
        for(let view of this.children) {
            let menuItem = view as BLBaseMenuItemComponent;
            height += menuItem.getHeight();
            height += margin;
        }
        height += 10;
        return height;
    }

    // private _makePositionStyle(direction: PopupDirection = PopupDirection.down, 
    //     align: PopupAlign = PopupAlign.center, 
    //     targetRect?: any, deltaX: number = 0, deltaY: number = 0) {
    //     _log('_makePositionStyle targetRect =>', targetRect);
    //     this.style = {width: this.width + 'px'};

    //     let menuHeight = this.getGuessMenuHeight();

    //     if(targetRect) {
    //         if (targetRect.top + targetRect.height + menuHeight > window.innerHeight) {
    //             direction = PopupDirection.up;
    //         }
    //         if(direction == PopupDirection.down) {
    //             this.top = Math.round(targetRect.top + targetRect.height + deltaY);
    //         } else if(direction == PopupDirection.up) {
    //             this.top =Math.round(targetRect.top - menuHeight + deltaY);
    //         }

    //         if (align == PopupAlign.left) {
    //             this.left = Math.round(targetRect.left + deltaX);
    //         } if (align == PopupAlign.center) {
    //             this.left = Math.round(targetRect.left + (targetRect.width - this.width) / 2 + deltaX);
    //         } if (align == PopupAlign.right) {
    //             this.left = Math.round(targetRect.left + targetRect.width - this.width + deltaX);
    //         }
    //     } else {
    //         this.top = 0;
    //         this.left = 0;
    //     }

    //     _log('_makePositionStyle style =>', this.style);
    // }
    
    onMouseOver() {
        this.isOver = true;
        //this.isShow = true;
        //console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', this.isOver, this.isShow);
    }

    onMouseOut() {
        this.isOver = false;
    }

}
