import { AfterViewInit, Component, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef } from '@angular/core';
//import { NotePlatformService } from 'src/_note-platform/services/note-platform.service';
import { BLViewComponent } from 'src/lib/bl-ui/components/bl-view/bl-view.component';

import { _log, _valid } from 'src/lib/cf-common/cf-common';
import { BLCalDayInfo, BLCalendarDayItemData } from 'src/lib/fb-noteapi/cf-noteapi';

// public previewSvgData?: string;
// public title?: string;                           => bg color
// public content?: string;                         => bg color
// public date?: string; // iso date string
// public drawingUrl?: string;                      
// public photoUrl?: string;           // 대표사진
// public stickerUrls?: Array<string>;
// //public mood?: Array<NPDataMoodType>;

///////////////////////////////////////////////////////////////////////////////////
// public numberOfImages?: number; // 페이지에 포함된 전체 사진 수
// public thumbImageUrl?: string;   // 사진과 그림을 동시에 표시할 일이 있을까?


// export class BLCalendarDayItemData {
//     public title?: string;
//     public content?: string;
//     public date?: string; // iso date string
//     public thumbImageUrl?: string;
//     public numberOfItems?: number;
//     public key?: string;
// }

// export interface BLCalDayInfo {
//     year: number;
//     month: number;
//     day: number;
//     itemData?: BLCalendarDayItemData;
// }

const DefaultCalendarStyle = {
    todayColor: '',
    saturDayColor: '',
    sunDayColor: ''
}

const ActiveColors = ['#5092FC', '#4179D9', '#3461B6', '#284993', '#1C316F'];

@Component({
    selector: 'bl-calendar-day-item',
    templateUrl: './bl-calendar-day-item.view.html',
    styleUrls: ['./bl-calendar-day-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLCalendarDayItemView) }]
})
export class BLCalendarDayItemView extends BLViewComponent {
    @Input() style = DefaultCalendarStyle;
    @Input() year: number = 0;;
    @Input() month: number = 0;;
    @Input() day: number = 0;
    @Input() isShow: boolean = true;
    @Input() itemData?: BLCalendarDayItemData;
    @Input() isToday: boolean = false;
    @Input() isThisMonth: boolean = true;
    @Input() isActived: boolean = false;
    @Input() isShowImage: boolean = false;
    @Input() height: number = 0;
    @Input() fontSize: number = 16;
    @Input() stickerHeight: number = 20;
    @Input() calendarPadding: any = { x: 7, y: 7 };
    @Input() fontColor: string = '#000';
    @Input() textColor: string = '#c8c8c8';

    @Output() clickItem = new EventEmitter<BLCalDayInfo>();

    constructor() {
        super();
    }

    override blOnInit(): void {
        //_log('BLCalendarDayItemView pageData', this.itemData);
    }

    // thumbnail이 없고 글만 있는 경우
    // hasOnlyTextContent() {
    //     if (!this.itemData) { return false; }
    //     return (!this.itemData.thumbImageUrl || this.itemData.thumbImageUrl.length == 0) &&
    //         ((this.itemData.title && this.itemData.title.length > 0) || (this.itemData.content && this.itemData.content.length > 0));
    // }


    // hasContent() {
    //     if(!this.itemData) { return false; } 
    //     return this.itemData.numberOfItems > 0;
    // }

    getItemCount() {
        if (!this.itemData || !this.itemData.numberOfItems) { return 0; }
        return this.itemData.numberOfItems;
    }

    // isShowImage = true
    // itemData?.thumbImageUrl = null

    getBackgroundColor() {
        let color = 'transparent';
        if (!this.itemData) { return color; }

        let level: number = 1;
        if (this.itemData.numberOfItems) {
            level = this.itemData.numberOfItems > 5 ? 5 : this.itemData.numberOfItems;
        }

        // 이전 그림일기에서 그린 그림, dark가 없으니 배경을 밝게 깔아준다.
        let url = this.theme == 'dark'? this.itemData.thumbImageUrlDark : this.itemData.thumbImageUrl;
        if (this.isShowImage && this.itemData.thumbImageUrl && !url?.includes('_dark')) {
            const lightBg = '#4d4d4d';
            color = lightBg;
        }

        // 이미지를 보여주는 상태인데 이미지를 아직 안넣은 경우 or 이미지 안보여주는 상태에서 글이 있는 경우 
        if ((this.isShowImage && !this.itemData.thumbImageUrl) || (!this.isShowImage && this.itemData.numberOfItems && this.itemData.numberOfItems > 0)) {
            color = ActiveColors[level - 1];
        }

        return color;
    }

    // getThumbImageBackground(): string {
    //     const darkBg = '#171818';
    //     const lightBg = '#4d4d4d';
    //     return this.pageData?.drawingUrl && this.pageData?.thumbImageUrl?.includes('_dark') ? darkBg : lightBg;
    // }

    getActiveBorderColor() {
        if (!this.isActived) { return ''; }
        const activeColor: string = '#5092FC';
        const whiteColor: string = '#e0e0e0';
        return this.hasImage() && this.isShowImage ? activeColor : whiteColor;
    }

    hasImage() {
        if (!this.itemData) { return false; }
        return (this.itemData.thumbImageUrl && this.itemData.thumbImageUrl.length > 0)
    }

    getPadding() {
        return `${this.calendarPadding.x}px ${this.calendarPadding.y}px`;
    }

    onClick() {
        if (!this.isShow) { return; }
        _log('BLCalendarDayItemView pageData =>', this.itemData);
        this.click();
    }

    private _oldTextColor?: string;
    click() {
        this._oldTextColor = this.textColor;
        this.textColor = '#3984FB';
        setTimeout(() => {
            let params: BLCalDayInfo = {
                year: this.year,
                month: this.month,
                day: this.day,
                itemData: this.itemData
            }
            this.clickItem.emit(params);

            if (this._oldTextColor) {
                this.textColor = this._oldTextColor;
            }
        }, 100);

    }

}

