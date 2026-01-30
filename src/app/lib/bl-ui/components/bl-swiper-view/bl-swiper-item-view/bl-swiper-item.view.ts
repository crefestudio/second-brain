import { AfterViewInit, Component, ElementRef, forwardRef, Input, Renderer2, TemplateRef, ViewChild } from '@angular/core';
import { BLViewComponent } from '../../bl-view/bl-view.component';

@Component({
    selector: 'bl-swiper-item',
    templateUrl: './bl-swiper-item.view.html',
    styleUrls: ['./bl-swiper-item.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSwiperItemView)}]
})
export class BLSwiperItemView extends BLViewComponent {
    @Input() item: any;
    
    constructor(
        public renderer : Renderer2,
    ) {
        super();
    }

    override blOnInit() {

    }
}
