import { Input, TemplateRef } from '@angular/core';

// @Component({
//     selector: 'bl-base-menu-item',
//     templateUrl: './BLBaseMenuItem.component.html',
//     styleUrls: ['./BLBaseMenuItem.component.css']
// })
export abstract class BLBaseToolbarItemComponent {
    // @ViewChild(TemplateRef) template!: TemplateRef<any>;
    public template!: TemplateRef<any>;
}
