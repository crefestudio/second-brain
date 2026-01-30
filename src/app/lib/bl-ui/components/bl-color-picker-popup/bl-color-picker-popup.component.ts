import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, TemplateRef, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
//import { NotePlatformService } from 'src/_note-platform/services/note-platform.service';
import { _log } from 'src/lib/cf-common/cf-common';
import { IPickedColorParams } from '../bl-color-picker/bl-color-picker.view';
import { BLPopupComponent } from '../bl-popup/bl-popup.component';

@Component({
    selector: 'bl-color-picker-popup',
    templateUrl: './bl-color-picker-popup.component.html',
    styleUrls: ['./bl-color-picker-popup.component.css'],
    encapsulation: ViewEncapsulation.None,
    providers: [{ provide: BLPopupComponent, useExisting: forwardRef(() => BLColorPickerPopupComponent)}]
})
export class BLColorPickerPopupComponent extends BLPopupComponent {
    @Input() color: string = '';
    @Input() customPalette: Array<string> = [];
    @Input() palette: any;
    @Input() scrollOption: boolean = true;
    //@Input() isMobileViewMode: boolean = false;
    @Output() colorChange = new EventEmitter();
    @Output() pickedColor = new EventEmitter<IPickedColorParams>();

    constructor(
        //appService: NotePlatformService,
        renderer: Renderer2, // mobile
        elRef: ElementRef // mobile
        ) {
        super(renderer, elRef);
    }
    
    onPickerSelect(palette: any) {
        // _log('onPickerSelect color =>', color);
        // let index = this.customPalette.findIndex(value => (value == color));
        // if(index > -1) { return; }
        // this.customPalette.push(color);
        this._pickedColor(palette);
    }

    onClickpalette(palette: any) {
        this._pickedColor(palette);
    }

    private _pickedColor(palette: any) {
        this.colorChange.emit(palette);
        this.pickedColor.emit(palette);
        this.hide();
    }

}
