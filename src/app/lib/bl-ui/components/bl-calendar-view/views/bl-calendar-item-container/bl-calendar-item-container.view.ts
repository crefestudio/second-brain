import { AfterViewInit, Component, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { BLViewComponent } from 'src/lib/bl-ui/components/bl-view/bl-view.component';
//import { AppEvent, MenuIds, AppCommand, AppProgress } from 'src/_note-platform/note-platform.config';

import { CFHelper, _log, _valid } from 'src/lib/cf-common/cf-common';
// import { SNNoteCalendarMonthDayView } from '../sn-note-calendar-month-day.view/sn-note-calendar-month-day.view';

const DefaultCalendarStyle = {
    todayColor: '',
    saturDayColor: '',
    sunDayColor: ''
}

@Component({
    selector: 'bl-calendar-item-container',
    templateUrl: './bl-calendar-item-container.view.html',
    styleUrls: ['./bl-calendar-item-container.view.css']
})
export class BLCalendarItemContainer extends BLViewComponent {
    @Input() style = DefaultCalendarStyle;  
    @Input() weekCount: number = 5;
    @Input() itemWidth: number = 300;
    @Input() headerHeight: number = 5;
    @Input() containerWidth: number = 0;
    @Input() padding = { top: 0, left:0, right: 0, bottom: 0 };

    public backgroundStyleString: string = '';
    public bgSizeStyleString: string = '';

    constructor(
        
    ) {
        super();
    }
}

