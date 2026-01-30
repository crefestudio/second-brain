import { Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../bl-view/bl-view.component';

export interface IPickedColorParams {
    color: string;
    customPalette?: Array<string>
}

@Component({
    selector: 'bl-color-picker',
    templateUrl: './bl-color-picker.view.html',
    styleUrls: ['./bl-color-picker.view.css'],
    encapsulation: ViewEncapsulation.None,
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLColorPickerView)}]
})
export class BLColorPickerView extends BLViewComponent {
    @Input() color: string = '';
    @Input() customPalette: Array<string> = [];
    @Input() palette: any;
    @Input() scrollOption: boolean = true;
    @Input() isMobileViewMode: boolean = true;
    @Output() colorChange = new EventEmitter();
    @Output() selectedCustomColor = new EventEmitter<IPickedColorParams>();

    constructor() {
        super();
    }

    
    onPickerSelect(color: string) {
        _log('onPickerSelect color =>', color);
        let index = this.customPalette.findIndex(value => (value == color));
        _log('onPickerSelect index =>', index);
        if(index == -1) { 
            this.customPalette.push(color);
        }
        this._pickedColor(color);
    }

    // onClickpalette(color: string) {
    //     this.sameCustomColor(color);
    //     this._pickedColor(color);
    // }

    sameCustomColor(color: string) {
     
    }

    private _pickedColor(color: string) {
        this.colorChange.emit(color);
        this.selectedCustomColor.emit({
            color: color,
            customPalette: this.customPalette
        });
    }
}
