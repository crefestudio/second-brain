import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLBaseMenuItemView } from '../bl-base-menu-item/bl-base-menu-item.view';

@Component({
    selector: 'bl-switch-menu-item',
    templateUrl: './bl-switch-menu-item.view.html',
    styleUrls: ['./bl-switch-menu-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSwitchMenuItemView)}]
})
export class BLSwitchMenuItemView extends BLBaseMenuItemView {
    @Input() isChecked?: boolean = true;
    @Input() disabled: boolean = false;
    @Input() description: string = '';
    @Input() tooltipDesc: string = '';
    @Input() isTooltip: boolean = false;
    @Input() isShowPremiumIcon: boolean = false;
    @Output() switchClick = new EventEmitter;

    constructor(
        renderer : Renderer2,
        alertService: BLAlertService,
    ) {
        super(renderer,alertService);
    }

    onChange() {
        if(this.disabled) {
            return;
        }
        this.isChecked = !this.isChecked;
        this.switchClick.emit({name: this.name, isChecked: this.isChecked});
    }
}
