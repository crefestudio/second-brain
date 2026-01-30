import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-toggle-button-toolbar-item',
    templateUrl: './bl-toggle-button-toolbar-item.component.html',
    styleUrls: ['./bl-toggle-button-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLToggleButtonToolbarItemComponent)}]
})
export class BLToggleButtonToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() img: string = '';
    @Input() text: string = '';
    @Input() tooltip: string = '';
    @Input() activatedImg?: string = '';
    @Input() buttonType: string = 'basic';
    @Input() groupId: string = '';
    @Input() disabled: boolean = false;
    @Input() moreBtn: boolean = false;
    @Input() checked: boolean = false;
    @Output() change = new EventEmitter;

    @Input() align: string = 'left';
    
    @Input() tooltipParentWidth: number = 0;
    @Input() tooltipParentHeight: number = 0;

    // @Output

    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
    }

    onChangeState(event: any) {
        this.change.emit(event);
        this.checked = event.isActivated;
        _log('onChangeState checked =>', this.checked);
        _log('bl-toggle-button-toolbar-item::onChangeState event =>', event);
    }
}
