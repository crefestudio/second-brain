import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLMenuPopupComponent, MenuPopupType } from '../../bl-menu-popup.component';
import { BLBaseMenuItemComponent } from '../bl-base-menu-item/bl-base-menu-item.component';

export interface IBLMenuItemParams {
    id: any;
    title: any;
    // exParams?: any;
}

@Component({
    selector: 'bl-menu-item',
    templateUrl: './bl-menu-item.component.html',
    styleUrls: ['./bl-menu-item.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLMenuItemComponent)}]
})
export class BLMenuItemComponent extends BLBaseMenuItemComponent {
    //@ViewChild(TemplateRef) _template!: TemplateRef<any>;
    //@Input() id: any;
    @Input() title: any;
    @Input() icon: any;         // 기본 아이콘
    @Input() iconWidth: number = 24;    // image에다가 고정크기 주면 svg내부 크기가 안먹음, 그 경우 크기가 안맞으면 이 값으로 조정
    @Input() iconHeight: number = 24;   // image고정 크기 안주게 해봤는데 그럼 아이콘 크기가 둘쑥날쑥함
    @Input() checkedIcon: any;  // checked icon : 현재는 북마크에서 사용함
    @Input() hotKey: any;
    @Input() gridIcon: string = '';
    
    @Input() hasSwitch: boolean = false;
    @Input() disabled: boolean = false;
    @Input() isWarning: boolean = false;
    @Input() checked?: boolean = false;     // 아이콘을 기본으로 보일 것인지 checked icon을 보일 것인지
    @Input() isSwitchOn: boolean = false;
    @Input() stateMessage: string = '';

    @Input() badgeType?: string;


    //@Input() exParams: any;

    @Output() clickItem = new EventEmitter<IBLMenuItemParams>();
    @Output() changeSwitch = new EventEmitter<boolean>();
    
    constructor(
    ) {
        super();
        // this.template = this._template;
        // this.test = 'menuItem';
    }

    override getHeight(): number {
        return 32;
    }


    // ngAfterViewInit(): void {
    //     this.template = this._template;
    // }

    onClickItem(id: string, title: string) {
        // 스위치형이면 클릭 메세지는 안보냄
        if(this.disabled || this.hasSwitch) {
            return;
        }
        this.clickItem.emit({id: id, title: title /*, exParams: this.exParams*/});
    }

    onClickSwitch() {
        this.isSwitchOn = !this.isSwitchOn;
        this.changeSwitch.emit(this.isSwitchOn);
    }
}
