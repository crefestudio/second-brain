import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-text-toolbar-item',
    templateUrl: './bl-text-toolbar-item.component.html',
    styleUrls: ['./bl-text-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLTextToolbarItemComponent)}]
})
export class BLTextToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() text: string = '';
    @Input() color: string = '#000';
    @Input() align: string = 'left';
    @Input() isDarkMode: boolean = false;

    @Output() clickButton = new EventEmitter<{id: string}>();
    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
    }

    onClick(event: any) {
        this.clickButton.emit({
            id: this.id,
        });
    }
}
