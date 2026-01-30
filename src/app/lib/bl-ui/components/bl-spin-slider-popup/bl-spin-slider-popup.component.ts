// import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, ViewEncapsulation } from '@angular/core';
// import { BLPopupComponent } from '../bl-popup/bl-popup.component';

// @Component({
//     selector: 'bl-spin-slider-popup',
//     templateUrl: './bl-spin-slider-popup.component.html',
//     styleUrls: ['./bl-spin-slider-popup.component.css'],
//     providers: [{ provide: BLPopupComponent, useExisting: forwardRef(() => BLSpinSliderPopupComponent)}],
//     encapsulation: ViewEncapsulation.None
// })
// export class BLSpinSliderPopupComponent extends BLPopupComponent {
//     @Input() value: any;
//     @Input() maxValue: number = 0;
//     @Input() minValue: number = 0;
//     @Input() headerTitle: string = '';
//     @Output() valueChange = new EventEmitter<number>();


//     constructor(
//         renderer: Renderer2, // mobile
//         elRef: ElementRef // mobile
//         ) {
//         super(renderer, elRef);
//     }

//     onChangeValue(value: number) {
//         this.valueChange.emit(value);
//     }
// }
