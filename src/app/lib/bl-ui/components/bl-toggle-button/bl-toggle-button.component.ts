import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLButtonComponent } from '../bl-button/bl-button.component';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-toggle-button',
    templateUrl: './bl-toggle-button.component.html',
    styleUrls: ['./bl-toggle-button.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLToggleButtonComponent)}]
})
export class BLToggleButtonComponent extends BLButtonComponent {
    @Input() isActivated: boolean = false;
    @Input() activatedImg?: string = '';
    @Output() change = new EventEmitter;
    @Input() set groupId(value: string) {
        this._groupId = value;
		BLToggleButtonComponent.addListener(value, this);
    }

    private _groupId?: string;

    override onClick(event: any) {
        super.onClick(event);
        // 그룹아이디가 있으면 라디오로 동작하기 때문에 true -> false할 수 없다. 
        // 하게 되면 다른 그룹버튼에 모두 false가 감 
        // 이때 false는 isUserAction : false 
        this.isActivated = !this.isActivated;
        let rect = event.target.parentElement.getBoundingClientRect();
        this.change.emit({id: this.id, isActivated: this.isActivated, rect: rect, isUserAction: true});
        _log('toggle-btn==============');
        // radio button
        if (this._groupId && this.isActivated) {
            BLToggleButtonComponent.fireClickEvent(this._groupId, this);
        }
    }

    // onClickButton() {        
    //     if(this.menuTriggerFor) {
    //         if(this.menuTriggerFor.isShow) {
    //             this.menuTriggerFor.close();
    //         } else {
    //             this.menuTriggerFor.popup();
    //         }
    //     }
    //     this.clickButton.emit(this.id);
    // }

    ///////////////////////////////////////
    // group , radio button process
    
    static listeners: any = {};
	static addListener(groupId: string, that: BLToggleButtonComponent) {
        if (!groupId) { return; }
		if (!BLToggleButtonComponent.listeners[groupId]) {
            BLToggleButtonComponent.listeners[groupId] = [];
        }
		BLToggleButtonComponent.listeners[groupId].push(that);
        console.log('BLToggleButtonComponent::addListener listeners', BLToggleButtonComponent.listeners);
    }

	static fireClickEvent(groupId: string, that: BLToggleButtonComponent) {
      	for(let listener of BLToggleButtonComponent.listeners[groupId]) {   
            // 나를 제외하고 unactive함 
            if(that !== listener) { 
                listener.unactivated();
            }
		}
	}

    public unactivated() {
        this.isActivated = false;
        this.change.emit({id: this.id, isActivated: false, rect: {}, isUserAction: false });
    }
}
