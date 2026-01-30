import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'bl-input',
    templateUrl: './bl-input.component.html',
    styleUrls: ['./bl-input.component.css'],
})
export class BLInputComponent {
    public _value: any;    

    @Output() valueChange = new EventEmitter<any | undefined>();
    // value 2way sync
    @Input() set value(val: any | undefined) {
        this._value = val;
    } 

    // property
    @Input() type: string = 'number';
    @Input() placeholder: string = '';
    @Input() disabled: boolean = false;
    @Input() readOnly: boolean = false;

    // @Input() minValue: number = 0;
    // @Input() maxValue: number = 0;
    // @Input() maxLength: number = 0;
    
    onChange(value: any) {
        console.log('BLInputComponent:ngModelChange value =>', value);
        this._value = value;
        this.valueChange.emit(this._value);
    }
}
