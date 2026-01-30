import { Component, ElementRef, EventEmitter, forwardRef, Input, OnInit, Output, Renderer2, ViewChild } from '@angular/core';
import { CFHelper, _log } from 'src/lib/cf-common/cf-common';
import { BLBaseMenuItemComponent } from '../bl-menu-popup/items/bl-base-menu-item/bl-base-menu-item.component';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-editable-text',
    templateUrl: './bl-editable-text.component.html',
    styleUrls: ['./bl-editable-text.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() =>BLEditableTextComponent)}]
})
export class BLEditableTextComponent extends BLViewComponent {
    @ViewChild('inputText', { static: false }) noteTitle!:  ElementRef<HTMLInputElement>;
    @Input() text: string = '';
    @Input() size: string = 'small';
    @Input() editIcon: any
    @Input() public set isEditMode(value: boolean) {
        this._isEditMode = value;
    }
    @Output() submit = new EventEmitter;
    @Output() isEditModeChange = new EventEmitter;
    
    public _isEditMode: boolean = false;
    public _text: string = '';

    constructor(
    ) {
        super();
    }

    onClickEdit() {
        if (this.text) {
            this._text = this.text;
        }    
        this._isEditMode = true;
        this.isEditModeChange.emit(this._isEditMode);
        setTimeout(() => {
            this._inputSelect();
        }, 0);
    }
    
    private _inputSelect() {
        const inputElement = this.noteTitle.nativeElement;
        CFHelper.element.select(inputElement);
        _log('bl-header-menu-item event value => ', inputElement);
    }

    onClickSave(text: string) {
        this._isEditMode = false;
        this.isEditModeChange.emit(this._isEditMode);
        if(text == this.text) { return; }
        this.submit.emit(text);
    }
}
