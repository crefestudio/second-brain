import { Directive, Renderer2, TemplateRef, ViewContainerRef, ElementRef, HostBinding, HostListener, NgZone, OnDestroy } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLResponsiveService } from '../service/bl-responsive.service';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Directive({
    selector: '[deviceClass]',
})
export class DeviceClassDirective implements OnDestroy {
    private resizeSubscription!: Subscription;
    constructor(
        private render: Renderer2,
        private elementRef: ElementRef,
        private responsiveService: BLResponsiveService, 
        private ngZone: NgZone) {
        this._apply()
        this.ngZone.runOutsideAngular(() => {
            this.resizeSubscription = fromEvent(window, 'resize')
                .pipe(debounceTime(200)) // 200ms 동안 연속 이벤트 방지
                .subscribe(() => {
                // Change Detection이 필요한 경우에만 run() 호출
                this.ngZone.run(() => this._apply());
            });
        });
    }

    ngOnDestroy() {
        // Directive가 제거될 때 이벤트 해제
        if (this.resizeSubscription) {
          this.resizeSubscription.unsubscribe();
        }
    }
    
    //@HostListener('window:resize', ['$event'])
    //onResize(event: Event) {
        // setTimeout(() => {
        //     this._reset();
        //     this._apply();
        // }, 1)
    //}

    // private _reset() {
    //     this.render.removeClass(this.elementRef.nativeElement, 'mobile');
    //     this.render.removeClass(this.elementRef.nativeElement, 'desktop');
    //     //this.render.removeClass(this.elementRef.nativeElement, 'tablet');
    // }

    private _apply() {
        let isMobile = this.responsiveService.isMobile();
        let isDesktop = this.responsiveService.isDesktop();

        if (isMobile) {
            this.render.removeClass(this.elementRef.nativeElement, 'desktop');
            this.render.addClass(this.elementRef.nativeElement, 'mobile');
        }
        if (isDesktop) {
            this.render.removeClass(this.elementRef.nativeElement, 'mobile');
            this.render.addClass(this.elementRef.nativeElement, 'desktop');
        }
    }
}

// ////////////////////////////////////////////////////////////////////////////////////////
const MIN_WIDTH_DESKTOP_VIEWMODE = 680;

@Directive({
    selector: '[viewModeClass]',
})
export class ViewModeClassDirective {
    private resizeSubscription!: Subscription;
    constructor(
        private render: Renderer2,
        private elementRef: ElementRef,
        private ngZone: NgZone) {
        this._apply()
        this.ngZone.runOutsideAngular(() => {
            this.resizeSubscription = fromEvent(window, 'resize')
                .pipe(debounceTime(200)) // 200ms 동안 연속 이벤트 방지
                .subscribe(() => {
                // Change Detection이 필요한 경우에만 run() 호출
                this.ngZone.run(() => this._apply());
            });
        });
    }

    ngOnDestroy() {
        // Directive가 제거될 때 이벤트 해제
        if (this.resizeSubscription) {
          this.resizeSubscription.unsubscribe();
        }
    }
    //@HostListener('window:resize', ['$event'])
    //onResize(event: Event) {
        // setTimeout(() => {
        //     this._reset();
        //     this._apply();
        // }, 1)
    //}

    // private _reset() {
    //     this.render.removeClass(this.elementRef.nativeElement, 'mobile');
    //     this.render.removeClass(this.elementRef.nativeElement, 'desktop');
    //     //this.render.removeClass(this.elementRef.nativeElement, 'tablet');
    // }
     
    private _apply() {
        let isDesktop =  window.innerWidth >= 1024;
        isDesktop =  window.innerWidth >= MIN_WIDTH_DESKTOP_VIEWMODE;
        if (isDesktop) {
            this.render.removeClass(this.elementRef.nativeElement, 'mobile');
            this.render.addClass(this.elementRef.nativeElement, 'desktop');
            //_log('ViewModeClassDirective desktop')
        } else {
            this.render.removeClass(this.elementRef.nativeElement, 'desktop');
            this.render.addClass(this.elementRef.nativeElement, 'mobile');
            //_log('ViewModeClassDirective mobile')
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////////
    
@Directive({
    selector: '[ifMobile]',
})
export class IfMobileDirective {
    constructor(
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        private responsiveService: BLResponsiveService, 
    ) {
        let isMobile = this.responsiveService.isMobile();
        this._updateView(isMobile);
    }

    _updateView(isShow: boolean) {
        if(isShow) {
            this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
            this.viewContainer.clear();
        }
    }
}

// @Directive({
//     selector: '[ifOnlyMobile]'
// })
// export class IfOnlyMobileDirective {
//     constructor(
//         private templateRef: TemplateRef<any>,
//         private viewContainer: ViewContainerRef,
//         private deviceService: DeviceDetectorService, 
//     ) {
//         let isMobile = !this.deviceService.isDesktop() && window.innerWidth < 1080;//this.deviceService.isMobile();
//         //let isMobile = true; // this.deviceService.isMobile();
//         //console.log('IfMobileDirective::ifMobile deviceService.isMobile() =>', isMobile);
//         this._updateView(isMobile);
//     }    

//     _updateView(isShow: boolean) {
//         if(isShow) {
//             this.viewContainer.createEmbeddedView(this.templateRef);
//         } else {
//             this.viewContainer.clear();
//         }
//     }
// }

// @Directive({
//     selector: '[ifTablet]'
// })
// export class IfTabletDirective {
//     constructor(
//         private templateRef: TemplateRef<any>,
//         private viewContainer: ViewContainerRef,
//         private responsiveService: BLResponsiveService, 
//     ) { 
//         let isTablet = this.responsiveService.isTablet();
//         this._updateView(isTablet);
//     }

//     _updateView(isShow: boolean) {
//         if(isShow) {
//             this.viewContainer.createEmbeddedView(this.templateRef);
//         } else {
//             this.viewContainer.clear();
//         }
//     }
// }

@Directive({
    selector: '[ifDesktop]'
})
export class IfDesktopDirective {
    public isMobile: boolean = false;
    public isDesktop: boolean = false;
    public isTablet: boolean = false;
    
    constructor(
        private templateRef: TemplateRef<any>,
        private viewContainer: ViewContainerRef,
        private responsiveService: BLResponsiveService, 
    ) {
        let isMobile = this.responsiveService.isMobile();
        let isDesktop = this.responsiveService.isDesktop();
       // let isTablet = this.responsiveService.isTablet();

        this._updateView(this.isDesktop);
    }

    _updateView(isShow: boolean) {
        if(isShow) {
            this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
            this.viewContainer.clear();
        }
    }
}