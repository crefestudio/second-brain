import { AfterViewInit, Component, forwardRef, TemplateRef, ViewChild } from '@angular/core';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLBaseMenuItemComponent } from '../bl-base-menu-item/bl-base-menu-item.component';

@Component({
    selector: 'bl-divider-menu-item',
    templateUrl: './bl-divider-menu-item.component.html',
    styleUrls: ['./bl-divider-menu-item.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() =>BLDividerMenuItemComponent)}]
})
export class BLDividerMenuItemComponent extends BLBaseMenuItemComponent {
    //@ViewChild(TemplateRef) _template!: TemplateRef<any>;

    constructor() {
        super();
    }

    override getHeight(): number {
        return 1;
    }

}
