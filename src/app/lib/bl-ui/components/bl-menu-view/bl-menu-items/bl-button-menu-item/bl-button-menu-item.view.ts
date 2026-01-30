import { AfterViewInit, Component, ElementRef, forwardRef, Input, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLBaseMenuItemView } from '../bl-base-menu-item/bl-base-menu-item.view';

@Component({
    selector: 'bl-button-menu-item',
    templateUrl: './bl-button-menu-item.view.html',
    styleUrls: ['./bl-button-menu-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLButtonMenuItemView)}]
})
export class BLButtonMenuItemView extends BLBaseMenuItemView {
    constructor(
        renderer : Renderer2,
        alertService: BLAlertService,
    ) {
        super(renderer,alertService);
    }

    onClick() {
        this.click.emit(this.name);
    }
}
