import { Component, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef, ElementRef } from '@angular/core';
import { CFHelper, _flog, _log, _valid } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from 'src/lib/bl-ui/components/bl-view/bl-view.component';
import { NPDateType, BLCalDayInfo, BLCalendarDayItemData } from 'src/lib/fb-noteapi/cf-noteapi';

export interface BLCalInputParams {
    year: number;
    month: number;
}

@Component({
    selector: 'bl-calendar-view',
    templateUrl: './bl-calendar.view.html',
    styleUrls: ['./bl-calendar.view.css']
})
export class BLCanlendarView extends BLViewComponent {
    @ViewChild('calendarContainer') public elCalendarContainer!: ElementRef;

    @Input() set yearMonth(param: BLCalInputParams) {
        this.activeMonth = new Date(param.year, param.month - 1);
        _log('yearMonth param, activeMonth =>', param, this.activeMonth);
        setTimeout(() => {
            this.updateCalendarDate();
        }, 1)
    }
    @Input() activeDate?: NPDateType; 
    @Input() today: Date = new Date();
    @Input() width: number = 320;
    @Input() padding: any = { top:0, right: 0, left: 0, bottom:0 };
    @Input() dayItemData: Record<string, BLCalendarDayItemData | undefined | boolean> = { };
    @Input() isShowImage: boolean = true;

    @Output() onRequestCalItemData = new EventEmitter<BLCalDayInfo>
    @Output() onClickDayItem = new EventEmitter<BLCalDayInfo>

    @HostListener('window:resize', ['$event'])
    onResize(event: Event) {
        //if(this.appService.isMobileViewMode()) {
            this.layoutCalendarView();
        //}
    }

    // calendar
    private activeMonth?: Date;
    public calInfo: any;

    public prevDays = [];
    public days = [];
    public nextDays = [];

    public itemSize: any = { calendarWidth: 360 };
    public gridStyle: string = '';

    public containerWidth: number = 0;

    //public calendarWrapHeight: number = 0;
    public monthTitleFontSize: number = 26;

    
    public calendarDayPadding: any = {
        x: 8,
        y: 6
    };

    constructor(
    ) {
        super();
    }

    override blOnInit() {
      
    }

    // getMonthName(month: number) {
    //     let engMonth: string[] = [
    //         'January', 'February', 'March', 'April', 'May', 'June',
    //         'July', 'August', 'September', 'October', 'November', 'December'
    //     ];

    //     if (month < 1 || month > 12) {
    //         return 'Invalid month';
    //     }
    //     return engMonth[month - 1];
    // }

    isToday(year: number, month: number, day: number) {
        return this.today.getFullYear() == year && this.today.getMonth() + 1 == month && this.today.getDate() == day;
    }

    isActiveDay(year: number, month: number, day: number) {
        if (!this.activeDate) { return false; }
        return this.activeDate.year == year && this.activeDate.month == month && this.activeDate.day == day ;
    }

    getDayItemData(year: number, month: number, day: number) : BLCalendarDayItemData | undefined  {
        // _log('BLCanlendarView::getItemData year, month, day =>', year, month, day);
        if (!this.dayItemData) { return undefined; }

        if (!this.dayItemData[`${year}-${month}-${day}`]) {
            this.dayItemData[`${year}-${month}-${day}`] = true;
            this.onRequestCalItemData.emit({ year: year, month: month, day: day });        
        } else if (this.dayItemData[`${year}-${month}-${day}`] === true) {
            return undefined;
        } 
        return this.dayItemData[`${year}-${month}-${day}`] as BLCalendarDayItemData;
    }
    

    // getPageData(page: NPPage): NPPageData | undefined {
    //     if (!this.pageData) { return undefined; }

    //     // 데이타가 없고 로딩중도 아니면
    //     if (this.pageData[`${page._key}`]) {
    //         if (this.pageData[`${page._key}`] !== true) {
    //             return this.pageData[`${page._key}`];
    //         }
    //         // 로딩중
    //     } else { // 데이타가 있음
    //         this.pageData[`${page._key}`] = true;
    //         this.onRequestPageData.emit(page);
    //     }
    //     return undefined;
    // }

    
    // goPrevMonth() {
    //     this.updateCalendarDate(-1);
    // }
    
    // goNextMonth() {
    //     this.updateCalendarDate(1);
    // }

    updateCalendarDate() {
        // if (!this.activeMonth || monthForChange == 0) {
        //     let currMonth = new Date();
        //     currMonth.setDate(1);  
        //     this.activeMonth = currMonth;
        // } else {
        //     this.activeMonth.setMonth(this.activeMonth.getMonth() + monthForChange);   
        // }
        _log('updateCalendarDate activeMonth =>', this.activeMonth);
        this.calInfo = CFHelper.date.calendarInfo(this.activeMonth);
        this.prevDays = Array.from({ length: this.calInfo.weekOfFirstDay });  // 일수 많큼 array
        this.days= Array.from({ length: this.calInfo.dayCountInMonth });
        this.nextDays = this.calInfo.weekOfLastDay == 0? [] : Array.from({ length: 7 - this.calInfo.weekOfLastDay });

        // calenar size update
        this.layoutCalendarView();
    }

    public layoutCalendarView() {
        if (!this.activeMonth) { return; }
        let heightDelta = 0;
        this.itemSize = this.calcCalendarItemSize(this.activeMonth, 0, heightDelta, this.padding, this.width);    
    }

    calcCalendarItemSize(dateMonth: Date, widthDelta: number, heightDelta: number, 
        padding = { top: 0, left:0, right: 0, bottom: 0 }, containerWidth: number) {
        _flog(this.calcCalendarItemSize, arguments);
        _log('calcCalendarItemSize containerWidth, width =>', containerWidth, this.width);

        let calInfo = CFHelper.date.calendarInfo(dateMonth);
        if (!calInfo) { return; }
        let weekCount = calInfo.weekCount;
        
        // 여백을 뺀 크기 
        let itemRate = 1;               
        let _containerWidth: number = containerWidth - widthDelta;
        let calHeight = (_containerWidth / 7) * itemRate * weekCount; // 462
        let calRate = calHeight / _containerWidth;
        
        
        _log('calcCalendarItemSize itemRate, weekCount, calHeight, calRate =>', 
            itemRate, weekCount, calHeight, calRate);

        let itemSize: any;
        let calendarWidth: number = 0;  
        //if (containerRate > calRate) {
            // 가로핏
            let itemWidth = (_containerWidth - padding.left - padding.right) / 7;
            itemSize = { width: itemWidth, height: itemWidth * itemRate};
            calendarWidth = _containerWidth;
        //} 
        // else {
        //     // 세로핏
        //     let itemHeight = (_containerHeight - _containerHeight * gridPaddings.top - _containerHeight * gridPaddings.bottom) / weekCount;
        //     itemSize = { width: itemHeight / itemRate, height: itemHeight }
        //     // 정확한 컨터이너 가로 길이를 알수 없다. 
        //     let containerW = (itemHeight / itemRate ) * 7;
        //     calendarWidth = itemSize.width * 7 + containerW * gridPaddings.left + containerW * gridPaddings.right;
        // }
        itemSize['calendarWidth'] = calendarWidth;

        // 비율을 px로 변환
        itemSize['padding'] = padding;
        itemSize['headerHeight'] = 17;

        // 달력의 길이를 기준으로 계산하고 max 26px로 잡아줌
        //itemSize['fontSize'] = 12; //Math.round((itemSize.width + itemSize.height) * 0.12);

        // 달력의 기로세로비를 내려준다. 외부에서 계산하면 안맞음 => 그림달력의 경우 강제 가로모드이기 때문에
        //itemSize['isVertViewMode'] = isVertViewMode;

        // 드로잉다이어리만 달력 폰트크기의 상한선을 둔다.
        // if (this.isDrawingDiaryApp()) {
        //     itemSize['fontSize'] = itemSize['fontSize'] > 34 ? 34 : itemSize['fontSize'];     // 43
        // }

        _log('BLCanlendarView::calcCalendarItemSize itemSize =>', itemSize, containerWidth, padding);
        return itemSize;
    }

    onClickCalendarDayItem(calDayInfo: BLCalDayInfo) {
        this.onClickDayItem.emit(calDayInfo);
    }

}

