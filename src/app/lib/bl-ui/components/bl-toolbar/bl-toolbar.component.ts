import { Component, Input, OnInit, Output, EventEmitter, ContentChildren, TemplateRef, QueryList, ViewChild, AfterViewInit } from '@angular/core';
import { BLButtonComponent } from '../bl-button/bl-button.component';
import { BLBaseToolbarItemComponent } from './items/bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-toolbar',
    templateUrl: './bl-toolbar.component.html',
    styleUrls: ['./bl-toolbar.component.css']
})
export class BLToolbarComponent implements AfterViewInit {
    @ContentChildren(BLBaseToolbarItemComponent) _items!: QueryList<BLBaseToolbarItemComponent>; 
    public items: any;
    @Input() toolbarAlign: string = '';
    @Input() toolbarItemSize?: number;
    @Input() padding: string = '';
    @Input() isMobileViewMode: boolean = false;
    @Output() clickButton = new EventEmitter;
    @Output() changeValue = new EventEmitter;

    constructor(
    ) {
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.items = this._items;
        }, 1)
    }

    ngOnInit(): void {
        // console.log('BLToolbar::ngOnIt() data =>', this.data);
    }

    onClick(id: any) {
        this.clickButton.emit(id);
        console.log('BLToolbar::onClick() id =>', id);
    }

    onChageValue(event: any) {
        this.changeValue.emit(event);
    }

}
