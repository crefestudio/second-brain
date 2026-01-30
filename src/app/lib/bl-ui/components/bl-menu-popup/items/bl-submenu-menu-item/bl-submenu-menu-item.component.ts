import { AfterViewInit, Component, ContentChild, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { BLAlertService } from 'src/lib/bl-ui/service/bl-alert.service';
import { BLViewComponent } from '../../../bl-view/bl-view.component';
import { BLMenuPopupComponent } from '../../bl-menu-popup.component';
import { BLBaseMenuItemComponent } from '../bl-base-menu-item/bl-base-menu-item.component';
import { BLMenuItemComponent } from '../bl-menu-item/bl-menu-item.component';

@Component({
    selector: 'bl-submenu-menu-item',
    templateUrl: './bl-submenu-menu-item.component.html',
    styleUrls: ['./bl-submenu-menu-item.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSubmenuMenuItemComponent)}]
})
export class BLSubmenuMenuItemComponent extends BLMenuItemComponent implements AfterViewInit {
    @ContentChild(BLMenuPopupComponent) menu!: BLMenuPopupComponent;

    constructor(
    ) {
        super();
        // this.template = this._template;
        // this.test = 'menuItem';
    }

    override getHeight(): number {
        return 32;
    }


    onMouseOver() {
        if(this.menu) {
            this.menu.isShow = true;
            console.log('onMouseOver this.menu => ', this.menu);
        }
        console.log('onMouseOver !this.menu => ', this.menu);
    }

    onMouseOut() {
        // if(this.menu) {
        //     setTimeout(() => {
        //         if(!this.menu.isOver) {
        //             this.menu.isShow = false;
        //         }
        //     }, 100);
        //     console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', this.menu, this.menu.isOver);
        // }
    }
}
