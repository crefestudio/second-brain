import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLMenuPopupComponent } from '../bl-menu-popup/bl-menu-popup.component';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-button',
    templateUrl: './bl-button.component.html',
    styleUrls: ['./bl-button.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLButtonComponent)}]
})
export class BLButtonComponent extends BLViewComponent {
    //@ViewChild(TemplateRef) public _template!: TemplateRef<any>;
    //public template: any;

    //@Input() id: string = '';
    @Input() img: string = '';
    @Input() imgWidth?: number;
    @Input() imgHeight?: number;

    @Input() text: string = '';
    @Input() textWidth?: number = 60;
    @Input() set position(styleObj: any) {
        if (styleObj) {
            this.positionStyle = { position: 'absolute'};
            Object.assign(this.positionStyle, styleObj);
        }
    }
    @Input() tooltip: string = '';
    @Input() moreBtn: boolean = false;
    @Input() disabled: boolean = false;
    @Input() menuTriggerFor: BLMenuPopupComponent | undefined;
    @Input() buttonType: string = 'basic';
    @Input() tooltipParentWidth: number = 0;
    @Input() tooltipParentHeight: number = 0;

    @Input() badgeType?: string; // dot, number

    @Output() clickButton = new EventEmitter;

    public positionStyle: any;
    public count: number = 0;    
    override blOnInit() {
    }

    onClick(event: any) {   
        _log('BLButtonComponent::onClick event =>', event);     
        event.stopPropagation();
        
        if(this.menuTriggerFor) {
            if(this.menuTriggerFor.isShow) {
                this.menuTriggerFor.hide();
            } else {
                this.menuTriggerFor.popup();
            }
        }
        let rect = event.target.parentElement.getBoundingClientRect();
        console.log('BLButtonComponent onClick =>', event.target.parentElement);

        this.clickButton.emit({
            id: this.id,
            rect: rect
        });
    }

}
