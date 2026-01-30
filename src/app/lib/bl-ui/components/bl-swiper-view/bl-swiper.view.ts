import { AfterViewInit, Component, ElementRef, EventEmitter, forwardRef, Input, OnInit, Output, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core'
import { _log } from 'src/lib/cf-common/cf-common';
import { SwiperComponent } from 'swiper/angular';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-swiper-view',
    templateUrl: './bl-swiper.view.html',
    styleUrls: ['./bl-swiper.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSwiperView)}]
})
export class BLSwiperView extends BLViewComponent implements OnInit {
    //@ViewChild('container') private containerEl!: ElementRef<HTMLElement>;
    @ViewChild('swiper') public swiper!: SwiperComponent;
    @Input() config: any;
    @Input() hasSideShadow: boolean = true;
    @Input() pagination: boolean = false;
    @Input() set isCompleteLoading(value: boolean) {
        if(value) {
            setTimeout(() => {
                console.log('BLSwiperView::ngAfterViewInit swiper1 =>', this.swiper);
                this.swiper.swiperRef.update();
            }, 100);
        }
    }
    public swiperRef: any;

    public isBeginning: boolean = true;

    constructor() {
        super();
    }

    ngOnInit(): void {
        console.log('BLSwiperView::ngAfterViewInit config =>', this.config);
        this.config.on =  {
            reachBeginning: function () {
//                this.isBeginning = true;
                //this.swiper.swiperRef.update();
            },
            reachEnd: function () {
                //              this.isEnd = true;
                //this.swiper.swiperRef.update();
            },
        };
    }

    // update() {
    //     this.swiper.swiperRef.update();
    // }
    
    i = 0;

    // afterViewInit
    override blOnInit() {
        console.log('BLSwiperView::ngAfterViewInit swiper2 =>', this.swiper);
        setTimeout(() => {
            this.swiper.swiperRef.update();
        }, 1000);
    }

    onSlideChange() {
        //this.safeUpdate();
        _log('======================>', this.swiper.swiperRef.activeIndex)
        this.isBeginning = this.swiper.swiperRef.activeIndex == 0;
    }

    safeUpdate() {
        // this.swiper.swiperRef.update();
        // for(let i = 1; i < 100; i++) {
        //     setTimeout(() => {
        //         _log('@@@@@@@@@@@@@@');
        //         this.swiper.swiperRef.update();
        //     }, i * 10);
    
        // }
    }

    getChild(child: any) {
        return child as BLSwiperView;
    }

    onClikPrev() {
        this.swiper.swiperRef.slidePrev();
    }

    onClikNext() {
        this.swiper.swiperRef.slideNext();
    }
}
