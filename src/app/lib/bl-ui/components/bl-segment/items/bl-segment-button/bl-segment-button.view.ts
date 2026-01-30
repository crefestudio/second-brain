import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { BLViewComponent } from '../../../bl-view/bl-view.component';

@Component({
    selector: 'bl-segment-button',
    templateUrl: './bl-segment-button.view.html',
    styleUrls: ['./bl-segment-button.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSegmentButtonView)}]
})
export class BLSegmentButtonView extends BLViewComponent {
    @Input() title: string = '';
    @Input() img: string = '';
    @Input() tooltip: string = '';
    @Input() activatedImg: string = '';

    @Input() tooltipParentWidth: number = 40;
    @Input() tooltipParentHeight: number = 40;
    @Input() tooltipAlign: string = "bottom";

    @Input() isActivated: boolean = false;
    @Input() disabled: boolean = false;

    @Input() hasBadge: boolean = false;

    @Input() isMobileViewMode: boolean = false;

    @Output() click = new EventEmitter;

    public styleType: string = '';

    constructor(
    ) {
        super();
    }

    onSelectSegment(id: string) {
        this.click.emit(id);
    }
}


