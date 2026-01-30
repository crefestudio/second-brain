import { Component, forwardRef, HostListener, Input, NgZone } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../bl-view/bl-view.component';
import { BLGridItemView } from './bl-grid-item-view/bl-grid-item.view';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
    selector: 'bl-grid-view',
    templateUrl: './bl-grid.view.html',
    styleUrls: ['./bl-grid.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLGridView)}]
})
export class BLGridView extends BLViewComponent {
 
    ////// 사용안함 나중에 뺴야함 ///////////////////////
    @Input() public width: number = 113;
    @Input() public height: number = 113;
    @Input() public pageWidth: number = 113;
    @Input() public pageHeight: number = 113;
    ///////////////////////////////////////////////////
    
    // public itemWidth: number = 94;
    @Input() isMobileViewMode: boolean = false; // 크기에 따른 비율 증가 계산을 위해서
    
    @Input() public containerWidth: number = -1;
    @Input() public minItemWidth: number = 113; // 한 아이템의 최소 가로 길이
    @Input() public minColumeCount: number = 3; // minColumeCount와 minItemWidth중 minColumeCount가 우선 한다.
    

    public gridStyle?: string = undefined;

    // @HostListener('window:resize', ['$event'])
    // onResize(event: Event) {
    //     this.updateLayout();
    // }

    @HostListener("wheel", ["$event"])
    public onScroll(event: WheelEvent) {
        event.stopPropagation();
    }

    private resizeSubscription!: Subscription;
    constructor(private ngZone: NgZone) {
        super();

        this.ngZone.runOutsideAngular(() => {
            this.resizeSubscription = fromEvent(window, 'resize')
                .pipe(debounceTime(200)) // 200ms 동안 연속 이벤트 방지
                .subscribe(() => {
                // Change Detection이 필요한 경우에만 run() 호출
                this.ngZone.run(() => this.updateLayout());
            });
        });
        //this.authUserId = this.appService.userId;
    }


    override blOnInit() {
        console.log('BLGridView::ngAfterViewInit child =>', this.child);

        // 나중에 처리해야 할 임시 코드
        if(this.containerWidth == -1) {
            if (this.isMobileViewMode) {
                this.containerWidth = window.innerWidth;
            } else {
                this.containerWidth = window.innerWidth < 1024 ? 330: 360;
            }
        }

        this.updateLayout();
    }

    override blOnDestory() {
        // Directive가 제거될 때 이벤트 해제
        if (this.resizeSubscription) {
            this.resizeSubscription.unsubscribe();
        }
    }
    
    private _calcItemWidth(_containerWidth: number, itemMinWidth: number = 113, minCol: number = 3, thumbPadding: number = 22, horiPadding: number = 20) {
        let width: number = itemMinWidth;
        let containerWidth: number = _containerWidth - horiPadding;
        
        let col = Math.floor(containerWidth / itemMinWidth); // floor 버림 
        if (col < 3 && col < minCol) { 
            col = minCol;
            width =  Math.floor(containerWidth / col - thumbPadding);
        } else { 
            width = itemMinWidth + (containerWidth % itemMinWidth) / col - thumbPadding;
        }
        _log('calcItemSize width, col =>', width, col);
        return Math.floor(width);
    }


    updateLayout() {
        // let itemWidth = this.itemWidth; //this.appService.calcItemWidth(containerWidth, 113, 3, 10, 20); // 113
        // if (this.isMobileViewMode) {
        //     itemWidth = this._calcItemWidth(this.containerWidth, itemWidth, 3, 0, 20);
        // } else {
        //     if(window.innerWidth < 1024) {
        //         itemWidth = 103;
        //     }
        // }

        _log('BLGridView::updateLayoutcontainerWidth =>', this.containerWidth);

        // col이 고정값이 아니라서 containerWidth안에 최소 itemWidth를 기준으로 적정 col개수를 얻는다.
        let itemWidth = this._calcItemWidth(this.containerWidth, this.minItemWidth, this.minColumeCount, 0, 0); 
        this.gridStyle = 'repeat(auto-fill, '+ itemWidth +'px)';
        _log('BLGridView::updateLayout itemWidth, gridStyle =>', itemWidth, this.gridStyle);

        // if(this.appService.isMobileViewMode()) {
        //     let boxWidth = this.appService.calcItemWidth(113, 3, 0, 20);
        //     this.gridStyle = 'repeat(auto-fill, '+ boxWidth +'px)';
        //     _log('grid::BLGridView::getItemSize boxWidth, count, gridStyle =>', boxWidth, this.gridStyle);

        // } else {
        //     //this.gridStyle = 'repeat(3, minmax(72px, 148px))';
        //     let base = this.width > this.height? this.width: this.height;
        //     let [big, small] = this.pageWidth > this.pageHeight ? [this.pageWidth, this.pageHeight]: [this.pageHeight, this.pageWidth];
        //     this.itemWidth = Math.round(this.pageWidth > this.pageHeight ? base : base * small/big);
        //     itemHeight = Math.round(this.pageHeight > this.pageWidth ? base : base * small/big);    
        //     _log('grid::BLGridView::getItemSize itemWidth, itemHeight =>', this.itemWidth, itemHeight);
        // }

        //return {width: this.itemWidth, height: itemHeight};
    }
    
    getChild(child: any) {
        return child as BLGridItemView;
    }
}
