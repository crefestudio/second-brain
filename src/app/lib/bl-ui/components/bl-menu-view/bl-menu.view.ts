import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { BLViewComponent } from '../bl-view/bl-view.component';
import { BLBaseMenuItemView } from './bl-menu-items/bl-base-menu-item/bl-base-menu-item.view';

@Component({
    selector: 'bl-menu-view',
    templateUrl: './bl-menu.view.html',
    styleUrls: ['./bl-menu.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLMenuView)}]
})
export class BLMenuView extends BLViewComponent {
    //@ViewChild('container') private containerEl!: ElementRef<HTMLElement>;

    constructor(
       // renderer: Renderer2,
    ) {
        super();
    }

    override blOnInit() {
        console.log('BLMenuView::ngAfterViewInit child =>', this.child);
        // for(let child of this.children) {
        //     child = child as BLGridItemView;
        // }
    }

    getChild(child: any) {
        return child as BLBaseMenuItemView;
    }
}
