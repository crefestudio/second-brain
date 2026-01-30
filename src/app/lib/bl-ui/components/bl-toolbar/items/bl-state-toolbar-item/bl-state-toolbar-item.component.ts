
import { AfterViewInit, Component, forwardRef, Input, Output, TemplateRef, ViewChild, EventEmitter } from '@angular/core';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-state-toolbar-item',
    templateUrl: './bl-state-toolbar-item.component.html',
    styleUrls: ['./bl-state-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLStateToolbarItemComponent)}]
})
export class BLStateToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() states: Array<any> = [];
    @Input() state?: string;
    @Input() align: string = 'left';
    @Input() disabled: boolean = false;

    @Output() changeState = new EventEmitter;

    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
        console.log('BLSelectToolbarItemComponent::ngAfterViewInit Template =>', this.template);
    }

    onChangeState(event: any) {
        this.changeState.emit(event);
    }
}
