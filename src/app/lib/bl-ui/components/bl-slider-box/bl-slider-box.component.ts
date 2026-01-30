import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, ViewEncapsulation } from '@angular/core';


@Component({
    selector: 'bl-slider-box',
    templateUrl: './bl-slider-box.component.html',
    styleUrls: ['./bl-slider-box.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class BLSliderBoxComponent {
    @Input() title: string = '';
    @Input() value: any;
    @Input() maxValue: number = 0;
    @Input() minValue: number = 0;
    @Input() numberOfChange: number = 1;
    @Input() unitText?: string;
    @Input() isMobileViewMode: boolean = false;

    @Output() valueChange = new EventEmitter<number>();

    onChangeValue1(value: number) {
        this.value = value;
        this.valueChange.emit(value);
    }

    onChangeValue2(value: number) {
        this.value = value;
        this.valueChange.emit(value);
    }
}
