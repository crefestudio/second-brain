import { AfterViewInit, Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLControlStyle } from '../../bl-common';

@Component({
    selector: 'bl-spin-number',
    templateUrl: './bl-spin-number.component.html',
    styleUrls: ['./bl-spin-number.component.css']
})
export class BLSpinNumberComponent implements AfterViewInit {
    @ViewChild(TemplateRef) public _template!: TemplateRef<any>;
    @Input() id: string = '';   
    @Input() numberOfChange: number = 1;
    @Input() minValue: number = 3;
    @Input() maxValue: number = 72;

    @Input() unitText?: string;
    @Input() options: Array<any> = [];
    @Input() disabled: boolean = false;

    @Input() boxSizeType: string = 'small';
    @Input() style: string = BLControlStyle.basic;
    @Input() get value() {
        return Math.round(this._value * 100) / 100;
        // return integerValue;
    }
    set value(val: number) {
        this._value = val;
    } 

    @Input() isMobileViewMode: boolean = false;
    @Output() valueChange = new EventEmitter<number>();

    public template: any;
    public showValue: string = '';
    public isShowOption: boolean = false;
    private _value: number = 0;

    constructor(
    ) {
        
    }

    ngAfterViewInit() {
        this.template = this._template;
        console.log('ngAfterViewInit() this.template => ', this.template);
        console.log('ngAfterViewInit() _value => ', this._value);
    }

    onFocusInput() {
        if(!this.disabled) {
            this.isShowOption = true;
        }
    }

    onBlurInput() {
        setTimeout(() => {
            this.isShowOption = false;
        }, 200)
    }

    onSelectOption(fontSize: number) {
        this.value = fontSize;
        this.valueChange.emit(fontSize);
    }

    onChangValue(event: any) {
        this.blurInput(event);
        if(this.value >= this.maxValue) {
            this.value = this.maxValue;
        }
        if(this._value <= this.minValue) {
            this._value = this.minValue;
        }
        this.valueChange.emit(this.value);
    }

    blurInput(event: any) {
        event.target.blur();
    }

    onClickDecrBtn() {
        if(this._value <= this.minValue) {
            return;
        }
        this.value = this.value - this.numberOfChange;
        this.valueChange.emit(this.value);
        console.log('blSpinNumber::onClickDecrBtn() value,numberOfChange => ', this.value, this.numberOfChange);
    }

    onClickIncrBtn() {
        if(this._value >= this.maxValue) {
            return;
        }
        this.value = this.value + this.numberOfChange;
        this.valueChange.emit(this.value);
        console.log('blSpinNumber::onClickIncrBtn() value,numberOfChange => ', this.value, this.numberOfChange);
    }

    // updateShowValue(value: number) {
    //     this.showValue = `${value}${this.unitText}`;
    // }
}
