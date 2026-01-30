import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { CFHelper, _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLBaseMenuItemComponent } from '../bl-base-menu-item/bl-base-menu-item.component';

@Component({
    selector: 'bl-header-menu-item',
    templateUrl: './bl-header-menu-item.component.html',
    styleUrls: ['./bl-header-menu-item.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() =>BLHeaderMenuItemComponent)}]
})
export class BLHeaderMenuItemComponent extends BLBaseMenuItemComponent {
    @Input() text: string = '';
    @Input() editIcon: any;
    @Input() writer?: string = '';
    @Input() description: any;
    @Output() save = new EventEmitter;
    public isEditMode: boolean = false;
    
    constructor(
    ) {
        super();
    }

    override blInitMenuItem() {
        this.isEditMode = false;
    }

    override getHeight(): number {
        return 45;
    }

    onClickSave(title: string) {
        this.save.emit(title);
    }
}
