import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLNavigation } from '../bl-navigation-panel-container/bl-navigation';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-panel',
    templateUrl: './bl-panel.component.html',
    styleUrls: ['./bl-panel.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLPanelComponent)}],
})
export class BLPanelComponent extends BLViewComponent {
    
    @Input() title?: string = '';
    @Input() titleFontFamily?: string;
    @Input() titleFontSize?: number;
    
    @Input() menuId?: string = '';
    @Input() menuDataParam?: any;
    
    @Input() titleButton: any;  
    @Input() rightButtons: Array<any> = [];
    @Input() hasCloseBtn: boolean = false;
    @Input() headerHeight: number = 56;

    @Input() activeSegmentId?: string;
    @Input() activeContentId?: string;

    // public containerWidth?: number;

    @Output() activeSegmentIdChange = new EventEmitter<string>();
    
    public navigation?: BLNavigation;

    constructor() {
        super();

    }

    // 패널이 나타날때
    blOnActiveView(viewId: string, segmentId?: string, contentId?: string, params?: any) {


    }

    // 패널이 사라질때
    blOnInactiveView() {

    }
    
}
