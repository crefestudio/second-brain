import { animate, state, style, transition, trigger } from '@angular/animations';
import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { _log, _valid } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-infinity-scroll-base',
    templateUrl: './bl-infinity-scroll-base.component.html',
    styleUrls: ['./bl-infinity-scroll-base.component.css'],
})
export class BLInfitityScrollBaseComponent implements AfterViewInit { 
    @ViewChild('listContainer') listContainer!: ElementRef;

    // option
    public useInfinityLoadPrevPage: boolean = true;

    constructor() {
        
    }

    ngAfterViewInit() {
        if (!this.listContainer) {
            //alert('BLInfitityScrollBaseComponent::#listContainer를 선언하세요')
            return;
        }
        this.listContainer.nativeElement.addEventListener('scroll', this.onScroll.bind(this));
        _log('BLInfitityScrollBaseComponent::ngAfterViewInit listContainer =>', this.listContainer);

        this.enableUpScroll();        

        setTimeout(() => {
            this.afterInitScrollContainer();
        }, 1)
    }

    afterInitScrollContainer() {

    }

    getContainerHeight() {
        _valid(this.listContainer);
        // 컨테이너가 display: none상태에서 시작하니 this.listContainer는 있는데 offsetHeight는 0이 나옴
        // 이걸 사용하는 컨테이너 3개가 모두 화면에 꽉차는 경우이니 window.innerHeight를 넣어줌
        let height = this.listContainer.nativeElement.offsetHeight? this.listContainer.nativeElement.offsetHeight : window.innerHeight;
        return height;
    }

    enableUpScroll() {
        // _valid(this.listContainer);
        if (!this.listContainer) { return; }
        // prev 이벤트를 얻기 위해
        const el = this.listContainer.nativeElement;
        if (el.scrollTop == 0) el.scrollTop = 1;
    }

    private ignoreScrollEvent: boolean = false;
    onScroll(event: Event) {
        
        const el = this.listContainer.nativeElement;
        _log('BLInfitityScrollBaseComponent::onScroll useInfinityLoadPrevPage, el.scrollTop =>', this.useInfinityLoadPrevPage, el.scrollTop)
        // const scrollTop = el.scrollTop;
        // const scrollHeight = 
        // const height = this.listContainer.nativeElement.offsetHeight;
        // _log('BLInfitityScrollBaseComponent::onScroll scrollTop, scrollHeight, height, getScrollRate(), ignoreScrollEvent =>', 
        //     el.scrollTop, el.scrollHeight, el.offsetHeight, this.getScrollRate(), this.ignoreScrollEvent);

        if (this.useInfinityLoadPrevPage && el.scrollTop == 0) {
            if (!this.ignoreScrollEvent) {
                this.ignoreScrollEvent = true;
                
                this.onNeedLoadPrevList();
                // setTimeout(() => {
                //     el.scrollTop += 265;
                // }, 10)
                
                setTimeout(() => {
                    this.ignoreScrollEvent = false;

                    // // prev 이벤트를 얻기 위해
                    const el = this.listContainer.nativeElement;
                    if (el.scrollTop == 0) {
                       el.scrollTop = 1;
                    }
                }, 500);
            }
        }

        if(this.getScrollRate() > 0.95) {
            if (!this.ignoreScrollEvent) {
                this.ignoreScrollEvent = true;
                // next 이벤트를 얻기 위해
                _log('BLInfitityScrollBaseComponent::onScroll =>', el.scrollTop + el.offsetHeight, el.scrollHeight);
                
                this.onNeedLoadNextList();
                
                setTimeout(() => {
                    this.ignoreScrollEvent = false;
                    // next 이벤트를 얻기 위해
                    // if (this.getScrollRate() > 0.995) {
                    //     //this.onNeedLoadNextList();
                    //     el.scrollTop -= 1; //Math.min(el.scrollHeight - el.offsetHeight - 10, el.scrollTop - 10);
                    // }
                }, 500);
            }
            
        }
    }

    getScrollRate() {
        const el = this.listContainer.nativeElement;
        return (el.scrollTop + el.offsetHeight) / el.scrollHeight;
    }

    onNeedLoadPrevList() {
        _log('onNeedLoadPrevList');
    }

    onNeedLoadNextList() {
        _log('onNeedLoadNextList');
    }

}
