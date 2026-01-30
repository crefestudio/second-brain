import { Directive, ElementRef, Renderer2 } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';

@Directive({ selector: '[bl-scroll-container]' })
export class BLScrollContainer {
    private static all: Array<BLScrollContainer> = [];

    constructor(public el: ElementRef, public _renderer: Renderer2) {
        BLScrollContainer.all.push(this);
        el.nativeElement.style.overflow = 'scroll';
    }

    public static enableAllScroll(ableScroll: boolean = true) {
        //_log('scroll static BLScrollContainer.all =>', BLScrollContainer.all);
        for(let me of BLScrollContainer.all) {
            //_log('scroll static me.el =>', me.el.nativeElement);
            me.el.nativeElement.style.overflow = ableScroll ? 'scroll' : 'hidden';   
            me.el.nativeElement.style = ableScroll ? 'overflow-x: hidden' : '';   
        }
    }
}

    // set hide(newCondition: boolean) {
    //     this.initDisplayStyle();

    //     if (newCondition && (isBlank(this._prevCondition) || !this._prevCondition)) {
    //     this._prevCondition = true;
    //     this._renderer.setElementStyle(this._elementRef.nativeElement, 'display', 'none');
    //     } else if (!newCondition && (isBlank(this._prevCondition) || this._prevCondition)) {
    //     this._prevCondition = false;
    //     this._renderer.setElementStyle(this._elementRef.nativeElement, 'display', this._displayStyle);
    //     }
    // }

    // private initDisplayStyle() {
    //     if (this._displayStyle === undefined) {
    //     let displayStyle = this._elementRef.nativeElement.style.display;
    //     if (displayStyle && displayStyle !== 'none') {
    //         this._displayStyle = displayStyle;
    //     }
    //     }
    // }

//     @Directive({
//         selector: '[ifTablet]'
//     })
//     export class IfTabletDirective {
//         constructor(
//             private element: ElementRef,
//             private templateRef: TemplateRef<any>,
//             private viewContainer: ViewContainerRef,
//             private deviceService: DeviceDetectorService, 
//         ) { 
        
//         }
    
//         @Input() set ifTablet(value) {  
//             console.log('IfTabletDirective::ifTablet deviceService.isTablet() =>', this.deviceService.isTablet());
//             let isTablet = !this.deviceService.isDesktop() && window.innerWidth >= 1080; // this.deviceService.isTablet();
//             this._updateView(isTablet);
//         }    
    
//         _updateView(isShow) {
//             if(isShow) {
//                 this.viewContainer.createEmbeddedView(this.templateRef);
//             } else {
//                 this.viewContainer.clear();
//             }
//         }
//     }
