import { AfterViewInit, Component, forwardRef, Input, TemplateRef, ViewChild } from '@angular/core';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-toolbar-divider',
    templateUrl: './bl-toolbar-divider.component.html',
    styleUrls: ['./bl-toolbar-divider.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLToolbarDividerComponent)}]
})
export class BLToolbarDividerComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() align: string = 'left';
    @Input() isDarkMode: boolean = false;

    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
    }
}
