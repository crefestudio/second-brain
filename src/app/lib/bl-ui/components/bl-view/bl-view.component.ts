import { AfterViewInit, Component, ContentChild, ContentChildren, EventEmitter, Input, OnDestroy, OnInit, Output, QueryList, TemplateRef, ViewChild, ViewChildren } from '@angular/core';
import { BLAlertService } from '../../service/bl-alert.service';

export enum BLThemeMode {
    light = 'light',
    dark = 'dark'
}

@Component({
    selector: 'bl-view',
    templateUrl: './bl-view.component.html',
    styleUrls: ['./bl-view.component.css']
})
export class BLViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('template') template!: TemplateRef<any>;
    @ContentChildren(BLViewComponent) children!: QueryList<BLViewComponent>;
    public child!: BLViewComponent;

    @Input() id: string = '';
    @Input() theme: string | BLThemeMode = BLThemeMode.dark;
    @Input() isDarkMode: boolean = this.theme == BLThemeMode.dark; // 이거 사용하지 말기, class=" {{theme}}" 이게 유리하기 때문

    constructor() {
        
    }
    
    ngAfterViewInit(): void {
        //console.log('BLViewComponent::ngAfterViewInit children =>', this.children);        
        //console.log('BLViewComponent::ngAfterViewInit child =>', this.child);
        
        this.child = this.children.first;
        //this.blOnInit();
        setTimeout(()=> {
            this.blOnInit();
        }, 1);
    }

    ngOnDestroy() {
        this.blOnDestory();
    }

    blOnInit() {

    }

    blOnDestory() {

    }

    getChildViewById(id: string) {
        for(let view of this.children.toArray()) {
            if(view.id == id) {
                return view;
            }
        }
        return null;
    }
}
