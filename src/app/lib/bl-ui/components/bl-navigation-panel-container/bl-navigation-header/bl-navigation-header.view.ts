import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild } from '@angular/core';
import { _log, _valid } from 'src/lib/cf-common/cf-common';
import { IBLMenuPopupEventParams } from '../../bl-menu-popup/bl-menu-popup.component';
import { PopupAlign } from '../../bl-popup/bl-popup.component';
import { BLNavigation } from '../bl-navigation';

export interface IBLNavigationHeaderEventParmas {
    id: string,
    navigation: BLNavigation
}
@Component({
    selector: 'bl-navigation-header',
    templateUrl: './bl-navigation-header.view.html',
    styleUrls: ['./bl-navigation-header.view.css']
})
export class BLNavigationHeaderView implements OnInit {

    @ViewChild('panelHeader') headerEl!: ElementRef;

    @Input() title?: string = '';
    @Input() titleFontFamily?: string;
    @Input() titleFontSize?: number;
    @Input() style = '';    // small, mobile, ''    
    @Input() theme: string = 'dark';
    @Input() isIn: boolean = false;
    @Input() hasCloseBtn: boolean = true;
    @Input() menuId?: string;
    @Input() menuDataParam?: any;
    @Input() titleButton: any = {};
    @Input() set rightButtons(value: Array<any>) {
        this._rightButtons = value;
        this.updateTitleBoxWidth();
    }
    private _rightButtons: Array<any> = [];
    get rightButtons() { return this._rightButtons; }

    @Input() height: number = 50;
    @Input() navigation?: BLNavigation;
    @Output() menu = new EventEmitter<IBLMenuPopupEventParams>();
    @Output() close = new EventEmitter;

    public titleBoxStyle: any = {};
    public titleBoxWidth: number = this.getInitTitleBoxWidth();

    constructor() {

    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any): void {
        this.updateTitleBoxWidth();
    }

    getInitTitleBoxWidth() {
        return 144; //window.innerWidth < 1024? 194 : 255;
    }

    ngOnInit() {
        if (this.titleFontFamily && this.titleFontFamily.length > 0) {
            this.titleBoxStyle['font-family'] = this.titleFontFamily;
        }
        if (this.titleFontSize && this.titleFontSize > 0) {
            this.titleBoxStyle['font-size'] = this.titleFontSize + 'px';
        }
        this.titleBoxWidth = this.getInitTitleBoxWidth();
        setTimeout(() => {
            this.updateTitleBoxWidth();
        }, 1000);
        _log('BLNavigationHeaderView::ngOnInit titleBoxStyle =>', this.titleBoxStyle)

        if (this.navigation) {
            this.navigation.event.subscribe(event => {
                this.titleBoxWidth = this.getInitTitleBoxWidth();
                _log('BLNavigationHeaderView event =>', event)
                setTimeout(() => {
                    this.updateTitleBoxWidth();
                }, 5);
                setTimeout(() => {
                    this.updateTitleBoxWidth();
                }, 10);
                setTimeout(() => {
                    this.updateTitleBoxWidth();
                }, 1000);
            }
            )
        };
    }

    updateTitleBoxWidth() {
        //_log('updateTitleBoxWidth1 titleBoxWidth =>', this.titleBoxWidth);
        let width = window.innerWidth < 1024 ? 330 : 360;
        if (this.headerEl && this.headerEl.nativeElement) { width = this.headerEl.nativeElement.clientWidth; }

        const padding = 24, backBtnWidth = 32, btnWidth = 40, rightBthWidth = 36, titleBtn = 40, spanPadding = 9;
        width -= padding;
        width -= spanPadding;
        if (this.isIn) { width -= backBtnWidth; }
        if (this.titleButton) { width -= titleBtn; }

        let rightBtns = this.rightButtons.filter((item: any) => !item.isHidden);
        width -= rightBthWidth * rightBtns.length;

        if (this.menuId) { width -= btnWidth; }
        if (this.hasCloseBtn) { width -= btnWidth; }
        this.titleBoxWidth = width;
        //_log('updateTitleBoxWidth2 titleBoxWidth =>', this.titleBoxWidth);
    }

    getTrimText(title: string) {
        return title.replace(/\s/g, '').length;
    }

    onClickBackBtn() {
        this.navigation?.back();
    }

    onClickMenuBtn(event: any) {
        let rect = event.target.parentElement.getBoundingClientRect();
        if (this.menuId) {
            let menuParams: IBLMenuPopupEventParams = {
                menuId: this.menuId,
                rect: rect,
                align: PopupAlign.right,
                item: this.menuDataParam
            }
            this.menu.emit(menuParams);
        }
    }

    onClickCloseBtn() {
        _log('bl-navigation-header close event =>');
        this.close.emit();
    }

    onClickTitleBtn(id: string) {
        this.titleButton.onClick({
            id: id,
            navigation: this.navigation
        });
    }

    onClickRightBtn(id: string) {
        for (let rightButton of this.rightButtons) {
            if (id == rightButton.id) {
                rightButton.onClick({
                    id: id,
                    navigation: this.navigation
                });
            }
        }
    }
}
