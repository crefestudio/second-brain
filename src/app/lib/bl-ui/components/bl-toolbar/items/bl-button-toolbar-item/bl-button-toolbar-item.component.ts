import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

export enum buttonType {
    button = 'button',
    file = 'file'
}

@Component({
    selector: 'bl-button-toolbar-item',
    templateUrl: './bl-button-toolbar-item.component.html',
    styleUrls: ['./bl-button-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLButtonToolbarItemComponent)}]
})
export class BLButtonToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() img: string = '';
    @Input() text: string = '';
    @Input() textWidth?: number;
    @Input() tooltip: string = '';
    @Input() type: string = buttonType.button;
    @Input() position: any;
    @Input() align: string = 'left';
    @Input() disabled: boolean = false;
    @Input() moreBtn: boolean = false;
    @Input() acceptFileExts: Array<string> = [];
    @Input() badgeType?: string;
    
    @Input() tooltipParentWidth: number = 0;
    @Input() tooltipParentHeight: number = 0;

    @Input() isDarkMode: boolean = false;

    @Output() clickButton = new EventEmitter;
    @Output() selectedFile = new EventEmitter;

    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
    }

    onClickButton(event: any) {
        this.clickButton.emit(event);
    }

    onSelectedFile(event: any) {
        this.selectedFile.emit(event);
    }
}
