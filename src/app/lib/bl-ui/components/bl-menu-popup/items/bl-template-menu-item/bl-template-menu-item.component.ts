import { AfterViewInit, Component, ContentChild, forwardRef, TemplateRef, ViewChild } from '@angular/core';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLBaseMenuItemComponent } from '../bl-base-menu-item/bl-base-menu-item.component';

@Component({
    selector: 'bl-template-menu-item',
    templateUrl: './bl-template-menu-item.component.html',
    styleUrls: ['./bl-template-menu-item.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() =>BLTemplateMenuItemComponent)}]
})
export class BLTemplateMenuItemComponent extends BLBaseMenuItemComponent {
    //@ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @ContentChild(TemplateRef) contentTemplate! : TemplateRef<any>;

    constructor() {
        super();
    }

    // 여기서 내 height를 return해야 함 
    override getHeight(): number {
        return 32;
    }


    // ngAfterViewInit(): void {
    //     this.template = this._template;
    // }
}
