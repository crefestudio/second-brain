
import { AfterViewInit, Component, forwardRef, Input, Output, TemplateRef, ViewChild, EventEmitter } from '@angular/core';
import { IToolbarItemState } from 'src/_note-platform/modules/app-common-ui/framework/toolbar-base.component';
import { BLControlStyle } from 'src/lib/bl-ui/bl-common';
import { IBLOption } from '../../../bl-select/bl-select.view';
import { BLBaseToolbarItemComponent } from '../bl-base-toolbar-item/bl-base-toolbar-item.component';

@Component({
    selector: 'bl-select-toolbar-item',
    templateUrl: './bl-select-toolbar-item.component.html',
    styleUrls: ['./bl-select-toolbar-item.component.css'],
    providers: [{ provide: BLBaseToolbarItemComponent, useExisting: forwardRef(() => BLSelectToolbarItemComponent)}]
})
export class BLSelectToolbarItemComponent extends BLBaseToolbarItemComponent implements AfterViewInit {
    @ViewChild(TemplateRef) _template!: TemplateRef<any>;
    @Input() id: string = '';
    @Input() align: string = 'left';
    @Input() style: string = BLControlStyle.basic;
    @Input() selectedStyle: boolean = false;

    @Input() theme: string = 'dark';
    @Input() value?: string; 
    @Input() height: number = 40;
    @Input() popupDirection: string = 'down';
    @Input() options: Array<IBLOption> = [{
        name: '',
        value: '',
    }];

    @Output() stateChange = new EventEmitter<IToolbarItemState>();
    
    constructor() {
        super();
    }

    ngAfterViewInit(): void {
        this.template = this._template;
        console.log('BLSelectToolbarItemComponent::ngAfterViewInit Template =>', this.template);
    }

    onSelect(_event: any) {
        let event: IToolbarItemState = {
            id: this.id,
            value: _event.value,
        };
        this.stateChange.emit(event);
    }
}
