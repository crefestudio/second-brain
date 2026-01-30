import { Component, ElementRef, forwardRef, Input, ViewChild } from '@angular/core';
import { _log, _valid } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from '../bl-view/bl-view.component';
import { BLSegmentButtonView } from './items/bl-segment-button/bl-segment-button.view';

@Component({
    selector: 'bl-segment',
    templateUrl: './bl-segment.view.html',
    styleUrls: ['./bl-segment.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLSegmentView)}]
})
export class BLSegmentView extends BLViewComponent {
    @ViewChild('container') private containerEl!: ElementRef<HTMLElement>;

    @Input() width?: number;
    @Input() height: number = 40;
    @Input() margin: string = '8px 0 16px';
    @Input() styleType: string = '';
    @Input() set activeSegmentId(segmentId: string | undefined) {
        _log('activeSegmentId segmentId =>', segmentId)
        if(!segmentId) { return; }
        this._activateSegmentId = segmentId;
        this.activateSegment(segmentId);
    }; 
    private _activateSegmentId: string = '';

    private _observerSegmentView: any = {};

    constructor() {
        super();
    }

    override blOnInit() {
        console.log('BLSegmentView::blOnInit child, children =>', this.child, this.children);
        // if (!this._isFirst) { return; }
        // this._isFirst = false;
        // let idx = 0;
        // 모두 unactived이면 처음것을 선택한다.
        if (this._activateSegmentId) {
            this.activateSegment(this._activateSegmentId);
        } else {
            let isAllUnactived: boolean = true;
            for(let child of this.children) {
                let segBtn: BLSegmentButtonView = child as BLSegmentButtonView;
                //_valid(segBtn);
                if (segBtn.isActivated) {
                    isAllUnactived = false;
                    break;
                }
            }
            if(isAllUnactived) {
                let segBtn = this.child as BLSegmentButtonView;
                //_valid(segBtn);
                if (segBtn) {
                    segBtn.isActivated = true;
                }
            }    
        }


        // event listener click 
        for(let child of this.children) {
            _log('child1 =>', child);
            let segBtn: BLSegmentButtonView = child as BLSegmentButtonView; // QueryLis
            let that = this;
            segBtn.styleType = this.styleType;

            if(!this._observerSegmentView[segBtn.id]) {
                this._observerSegmentView[segBtn.id] = segBtn.click?.subscribe(id => {
                    that.unactiveAll();
                    segBtn.isActivated = true;
                    console.log('BLSegmentView::this._observerSegmentView =>', this._observerSegmentView);
                });
            }
        }
    }

    override blOnDestory() {
        _log('BLSegmentView::blOnDestory')
        for(let key in this._observerSegmentView) {
            if (this._observerSegmentView[key]) {
                this._observerSegmentView[key].unsubscribe();
            }
        }
    }

    activateSegment(segmentId: string) {
        if(!this.children) {
            return;
        }
        for(let child of this.children) {
            let segBtn: BLSegmentButtonView = child as BLSegmentButtonView;
            if(!segBtn) {
                continue;
            }
            if (segBtn.id == segmentId) {
                segBtn.isActivated = true;
            } else {
                segBtn.isActivated = false;
            }
        }
    }

    unactiveAll() {
        for(let child of this.children) {
            let segBtn: BLSegmentButtonView = child as BLSegmentButtonView;
            segBtn.isActivated = false;
        }
    }
}
