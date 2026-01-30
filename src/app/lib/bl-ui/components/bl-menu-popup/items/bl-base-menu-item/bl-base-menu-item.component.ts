import { AfterViewInit, Component, ContentChild, ContentChildren, Directive, EventEmitter, forwardRef, Input, OnInit, Output, QueryList, TemplateRef, ViewChild } from '@angular/core';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { MenuPopupType } from '../../bl-menu-popup.component';

@Component({
    selector: 'bl-base-menu-item',
    templateUrl: './bl-base-menu-item.component.html',
    styleUrls: ['./bl-base-menu-item.component.css'],
    //providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLBaseMenuItemComponent)}]
})
export class BLBaseMenuItemComponent extends BLViewComponent {
    public type: string = MenuPopupType.list;
    public isShowHotKey: boolean = true;
    public itemHeight: number = 35;
    //@ViewChild(TemplateRef) template!: TemplateRef<any>;
    // public template!: TemplateRef<any>;
    // @ContentChildren(BLBaseMenuItemComponent) items!: QueryList<BLBaseMenuItemComponent>;    
    //public test: string = 'base';

    // ngAfterViewInit(): void {
    //     //this.template = this._template;
    // }

    public blInitMenuItem() {

    }

    public getHeight(): number {
        return 36;
    }

}
