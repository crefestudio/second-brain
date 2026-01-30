import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../../bl-view/bl-view.component';

@Component({
    selector: 'bl-base-menu-item',
    templateUrl: './bl-base-menu-item.view.html',
    styleUrls: ['./bl-base-menu-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLBaseMenuItemView)}]
})
export class BLBaseMenuItemView extends BLViewComponent {
    @Input() name: string = '';
    @Input() height: number = 48;
    @Input() hasBottomBorder: boolean = true; // 메뉴 구분선
    @Output() click = new EventEmitter;

    constructor(
        public renderer : Renderer2,
        public alertService: BLAlertService,
    ) {
        super();
    }

}
