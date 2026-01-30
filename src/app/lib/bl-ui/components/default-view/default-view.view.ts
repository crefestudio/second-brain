import { AfterViewInit, Component, forwardRef } from '@angular/core';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'default-view',
    templateUrl: './default-view.view.html',
    styleUrls: ['./default-view.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => DefaultView)}]
})
export class DefaultView extends BLViewComponent {
    constructor() {
        super();
    }

    // 하위 요소가 모두 로딩 된 후 호출 됩니다. 
    // 여기서 부터 template, children, child가 유효 합니다.
    override blOnInit() {

    }

}
