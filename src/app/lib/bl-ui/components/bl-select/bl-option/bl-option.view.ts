import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../bl-view/bl-view.component';

@Component({
    selector: 'bl-option',
    templateUrl: './bl-option.view.html',
    styleUrls: ['./bl-option.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLOptionView)}]
})
export class BLOptionView extends BLViewComponent {
    @Input() name: string = '';
    @Input() value: any;
    @Input() style?: string = '';
    @Input() isSelected: boolean = false;

    constructor() {
        super();
    }

    override blOnInit() {
    }
}
