import { Options } from 'ngx-slider-v2';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-slider',
    templateUrl: './bl-slider.component.html',
    styleUrls: ['./bl-slider.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class BLSliderComponent {
    @Input() value: any;
    @Input() set minValue(value: number) {
        const newOptions: Options = Object.assign({}, this.options);
        newOptions.floor = value;
        this.options = newOptions;
    }
    @Input() set maxValue(value: number) {
        const newOptions: Options = Object.assign({}, this.options);
        newOptions.ceil = value;
        this.options = newOptions;
    }
    @Input() set step(value: number) {
        const newOptions: Options = Object.assign({}, this.options);
        newOptions.step = value;
        this.options = newOptions;
    }
    @Output() valueChange = new EventEmitter();
    
    public options: Options = {
        floor: 0,
        ceil: 200,
        animate: false,
        step: 0.5
    };

    onChangeValue(value: number) {
        this.valueChange.emit(this.value);
    }
}
