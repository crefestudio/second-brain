import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLControlStyle } from '../../bl-common';
import { BLViewComponent } from '../bl-view/bl-view.component';
import { BLOptionView } from './bl-option/bl-option.view';

export interface IBLOption {
    name: string;
    value: string;
    style?: string;
}

@Component({
    selector: 'bl-select',
    templateUrl: './bl-select.view.html',
    styleUrls: ['./bl-select.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSelectView)}]
})
export class BLSelectView extends BLViewComponent {
    @Input() set value(val: string | undefined) {
        if (!val || val.length == 0) { return; }
        this.selectedValue = val;
        this.valueChange.emit(val);
        // for(let child of this.children) {
        //     let option =  this.getChild(child);
        //     if (this.value == option.value) {
        //         this.selectedOption = { name: option.name, value: option.value };
        //         this.valueChange.emit(option.value);
        //         alert('22222 '+ option.value)

        //         break;
        //     }
        // }
    }
    @Input() style: string = BLControlStyle.basic;
    @Input() disable: boolean = false;
    @Input() selectedStyle: boolean = false;
    @Input() isCheckImg: boolean = false;    
    @Input() height: number = 40;
    @Input() width: number = 174;
    @Input() popupDirection: string = 'down';

    @Input() optionBoxHeight?: number;
    
    @Output() selected = new EventEmitter<IBLOption>();
    @Output() valueChange = new EventEmitter<string>();

    private static selectBoxes: Array<BLSelectView> = [];
    private static activeSelectBox?: BLSelectView;
    // public selectedOption: IBLOption = {
    //     name: '',
    //     value: ''
    // }
    public selectedValue: string;
    public isOpenSelectList: boolean = false;

    constructor() {
        super();
        this.selectedValue = '';
        BLSelectView.selectBoxes.push(this);
    }
    
    @HostListener("wheel", ["$event"])
    public onScroll(event: WheelEvent) {
        event.stopPropagation();
    }

    override blOnInit() {
        console.log('BLSelectView::ngAfterViewInit child =>', this.child);
        
        if (!this.selectedValue || this.selectedValue.length == 0) {
            this.initialSelect();   
        }


        // 초기 값이 설정 되었다면 
        // if (this.selectedOption.value && this.selectedOption.value.length > 0) {
        //     this.valueChange.emit(this.selectedOption.value);
        //     alert('dddd '+ this.selectedOption.value)
        // }
    }

    initialSelect() {
        let idx = 0;
        for(let child of this.children) {
            let option =  this.getChild(child);
            // 초기 값이 없다면 첫번째 값이거나 selected ture인 값   
            if(idx == 0 || option.isSelected) {
                this.selectedValue = option.value;
            }
            idx++;
        }
    }

    getChild(child: any) {
        return child as BLOptionView;
    }

    getSelectedName() {
        let name: string = '';
        for(let child of this.children) {
            let option =  this.getChild(child);
            if (this.selectedValue == option.value) {
                name = option.name;
            }
        }
        return name;
    }

    onClickSelectBox() {
        this.isOpenSelectList = !this.isOpenSelectList;
        if(this.isOpenSelectList) {
            BLSelectView.activeSelectBox = this;
            setTimeout(() => {
                BLSelectView.activeSelectBox = undefined;
            }, 100);
        }
    }

    onClickSelectItem(option: any) {
        this.isOpenSelectList = false;
        // let selectedOption = {
        //     name: option.name,
        //     value: option.value
        // }
        this.selectedValue = option.value;
        this.valueChange.emit(option.value);
        this.selected.emit(option);
    }

    static hideAll() {
        for(let selectBox of BLSelectView.selectBoxes) {
            if(BLSelectView.activeSelectBox == selectBox) {
                continue;
            }
            selectBox.isOpenSelectList = false;
        }
    }
}
