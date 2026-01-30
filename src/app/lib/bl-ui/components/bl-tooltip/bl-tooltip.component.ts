import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { _log } from 'src/lib/cf-common/cf-common';

enum TooltipAlign {
    top = 'top',
    bottom = 'bottom',
    right = 'right',
    left = 'left'
}

@Component({
    selector: 'bl-tooltip',
    templateUrl: './bl-tooltip.component.html',
    styleUrls: ['./bl-tooltip.component.css'],
})
export class BLTooltipComponent implements AfterViewInit {
    @Input() tooltip: string = "";
    @Input() align: string = TooltipAlign.bottom;
    @Input() pWidth: number = 0;
    @Input() pHeight: number = 0;
    @Input() maxWidth: number = 0;

    public imgStyle: any = {};
    public tooltipStyle: any = {
    };

    constructor() {
    }

    ngAfterViewInit(): void {
        this.getTooltipPosition();
    }

    getTooltipPosition() {
        if(this.align == TooltipAlign.bottom) {
            this.imgStyle =  {
                top: this.pHeight + 'px'
            }
            this.tooltipStyle = {
                top: (this.pHeight + 7) + 'px'
            }
        } else if(this.align == TooltipAlign.top) {
            this.imgStyle =  {
                bottom: this.pHeight + 'px'
            }
            this.tooltipStyle = {
                bottom: (this.pHeight + 7) + 'px'
            }
        } else if(this.align == TooltipAlign.right) {
            this.imgStyle =  {
                left: this.pWidth + 'px'
            }
            this.tooltipStyle = {
                left: (this.pWidth + 7) + 'px'
            }
        } else if(this.align == TooltipAlign.left) {
            this.imgStyle =  {
                bottom: this.pHeight + 'px'
            }
            this.tooltipStyle = {
                bottom: (this.pHeight + 7) + 'px'
            }
        }
        if(this.maxWidth > 0) {
            this.tooltipStyle = {
                ...this.tooltipStyle,
                'max-width': this.maxWidth + 'px'
            }
        } else {
            this.tooltipStyle = {
                ...this.tooltipStyle,
                'max-width': 'none'
            }
        }
    }
    
    // public _value: any;    

    // // value 2way sync
    // @Input() set value(val: any | undefined) {
    //     this._value = val;
    // } 
    // @Output() valueChange = new EventEmitter<any | undefined>();
    // onChange(value: any) {
    //     console.log('BLInputComponent:ngModelChange value =>', value);
    //     this._value = value;
    //     this.valueChange.emit(this._value);
    // }

    // // property
    // @Input() placeholder: string = '';
    // @Input() disabled: boolean = false;    
    // @Input() isPassword: boolean = false;

}
