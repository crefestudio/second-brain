
import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { IToolbarItemState } from 'src/_note-platform/modules/app-common-ui/framework/toolbar-base.component';
import { BLControlStyle } from 'src/lib/bl-ui/bl-common';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-spin-number-toolbar-item',
    templateUrl: './bl-spin-number-toolbar-item.component.html',
    styleUrls: ['./bl-spin-number-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLSpinNumberToolbarItemComponent)}]
})
export class BLSpinNumberToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() align: string = 'left';
    @Input() style: string = BLControlStyle.basic;
    @Input() minValue: number = 3;
    @Input() maxValue: number = 72;
    @Input() disabled: boolean = false;
    @Input() options: Array<any> = [];
    @Input() isMobileViewMode: boolean = false;
    @Input() get value() {
        return this._value;
    }
    set value(val: number) {
        this._value = val;
    } 
    @Output() stateChange = new EventEmitter<IToolbarItemState>();

    private _value: number = 0;

    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
        console.log('BLSelectToolbarItemComponent::ngAfterViewInit Template =>', this.template);
    }

    onChangeValue(value: number) {
        let event: IToolbarItemState = {
            id: this.id,
            value: value
        };
        this.stateChange.emit(event);
    }
}
