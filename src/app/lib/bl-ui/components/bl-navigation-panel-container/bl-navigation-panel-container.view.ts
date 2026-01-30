import { Component, Input, OnInit, Output, EventEmitter, ContentChildren, QueryList, forwardRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { trigger, state, style, animate, transition } from '@angular/animations';

import { _log, _slog, _valid } from 'src/lib/cf-common/cf-common';
import { BLViewComponent } from 'src/lib/bl-ui/components/bl-view/bl-view.component';
import { BLPanelComponent } from 'src/lib/bl-ui/components/bl-panel/bl-panel.component';
import { BLNavigation, BLNavigationLocation } from './bl-navigation';
import { IBLMenuPopupEventParams } from '../bl-menu-popup/bl-menu-popup.component';

@Component({
    selector: 'bl-navigation-panel-container',
    templateUrl: './bl-navigation-panel-container.view.html',
    styleUrls: ['./bl-navigation-panel-container.view.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLNavigationPanelContainerView) }],
    animations: [
        trigger('flyInOut', [
            // state('in', style({ transform: 'translateX(0)' })),
            // transition('void => *', [
            //     style({ transform: 'translateX(-100%)' }),
            //     animate(100)
            // ]),
            // transition('* => void', [
            //     animate(100, style({ transform: 'translateX(100%)' }))
            // ])
        ])
    ]
})
export class BLNavigationPanelContainerView extends BLViewComponent {
    @ViewChild('BLNavigationPanelContainer') elNaviContainer!: ElementRef;

    @Input() initActiveLocation: string = '';
    @Input() initActiveViewParams?: any;
    //@Input() heightStyle?: string;
    @Input() headerStyle: string = '';   // mobile, small
    @Input() backgroundColor: string = '';
    @Input() useSyncUrl: boolean = false;   // url주소 시스템을 사용함
    @Input() hasCloseBtn: boolean = false;
    @Input() isFullScreen: boolean = false;
    @Input() rootUrl: string = '';          // 현 컨테이너의 root url
    @Input() set paddingTop(value: number) {
        this._paddingTop = value;
        _log('set paddingTop _paddingTop =>', this._paddingTop);
        //this.adjustHeaderStyle();
    }
    @Input() set paddingBottom(value: number) {
        this._paddingBottom = value;
        //this.adjustHeaderStyle();
    }

    @Output() close = new EventEmitter();
    @Output() openMenu = new EventEmitter<IBLMenuPopupEventParams>();
    public isTransition: boolean = false;
    public activeView!: BLPanelComponent;
    public navigation: BLNavigation = new BLNavigation();   // stack navigation
    public _style: any = {};

    private _observerRouter: any;
    private _observerNavigation: any;
    public _paddingTop: number = 0;
    private _paddingBottom: number = 0;

    static classId: number = 0;

    constructor(
        private router: Router,
        private activeRoute: ActivatedRoute) {
        super();
        this._routeProcess();
        BLNavigationPanelContainerView.classId++;
    }

    override blOnInit() {
        _log('BLNavigationPanelContainerView::blOnInit router.url =>', this.router.url, this)
        // if (this.heightStyle) {
        //     this._style = {
        //         height: this.heightStyle,
        //     }
        // }
        
        // 모바일에서 화면에 꽉차게
        if (this.isFullScreen) {
            this._style['width'] = window.innerWidth + 'px';
        }      

        if (this.backgroundColor && this.backgroundColor.length > 0) {
            this._style['background'] = this.backgroundColor;
        }

        setTimeout(() => {
            this._initNaviation();
            this._initActiveView();
        }, 0);

        //this.adjustHeaderStyle();
    }

    override blOnDestory() {
        _log('BLNavigationPanelContainerView::blOnDestory')
        if (this._observerRouter) {
            this._observerRouter.unsubscribe();
        }
        if (this._observerNavigation) {
            this._observerNavigation.unsubscribe();
        }
        // if (this._observerActiveRoute) {
        //     this._observerActiveRoute.unsubscribe();
        // }
    }

    // getStyleWidthString() {
    //     return this.isFullScreen? window.innerWidth + 'px' : ''
    // }

    private _initNaviation() {
        _log('_initNaviation this.rootUrl', this.rootUrl);
        // if (this._isInitNavigation) {
        //     return;
        // }
        // this._isInitNavigation = true;

        //navigation
        for (let view of this.children) {
            let panel = view as BLPanelComponent;
            panel.navigation = this.navigation;
        }
        if (this.useSyncUrl) {
            // 처음에 1회 실행하고
            //if (!this._observerRouter) {
            this.setActiveViewFromUrl(this.router.url);
            //}
            // 이후에는 이벤트 받아서 실행
            //this._routeProcess();
        }

        // navigation event handler
        if (!this._observerNavigation) {
            this._observerNavigation = this.navigation.event.subscribe(event => {
                if (event.id) {
                    // 주소를 이용하면 바로 이동안하고 주소를 통해 이동한다.
                    if (this.useSyncUrl) {
                        _valid(this.rootUrl && this.rootUrl.length > 0);
                        let url: string = this.navigation.getLocation(event, true);   // 주소 ? locationParams
                        let _url = this.rootUrl + '/' + url;
                        _log('_initNaviation url, event =>', _url, event);

                        // 오른쪽에 노트가 열렸을 경우를 대비해서 기존에 쿼리 파람을 유지한다.
                        let queryParams: any = {};
                        Object.assign(queryParams, this.activeRoute.snapshot.queryParams);
                        if (event.params) {
                            queryParams = Object.assign(queryParams, { locationParams: JSON.stringify(event.params) });
                        } else {
                            queryParams['locationParams'] = undefined;
                        }
                        // && (event.params.editType || event.params.viewType)) {
                        //     queryParams = { locationParams : event.params };
                        // // }
                        // Object.assign(queryParams, this.activeRoute.snapshot.queryParams);
                        _log('BLNavigationPanelContainerView::navigation _url, queryParams =>', _url, queryParams);
                        this.router.navigate([_url], { queryParams: queryParams });
                    } else {
                        _log('BLNavigationPanelContainerView::navigation event =>', event);
                        this.setAcvtiveView(event.id, event.segmentId, event.contentId, event.params);
                    }
                }
            })
        }
    }

    private _routeProcess() {
        //this.setActiveViewFromUrl(this.router.url);
        if (this._observerRouter) { return; }
        _log('_routeProcess rootUrl, router.url =>', this.rootUrl, this.router.url);
        this._observerRouter = this.router.events.subscribe((event) => {
            //_log('_routeProcess event =>', event);
            if (event instanceof NavigationEnd) {
                _log('_routeProcess::NavigationEnd event, rootUrl, BLNavigationPanelContainerView.classId =>', event, this.rootUrl, BLNavigationPanelContainerView.classId);
                _log('_routeProcess::NavigationEnd router.url =>', this.router.url, this.navigation.naviStack);
                if (this.useSyncUrl) { this.setActiveViewFromUrl(this.router.url); }
            }
        });
        return this._observerRouter;
    }

    setActiveViewFromUrl(url: string) {
        _valid(this.rootUrl && this.rootUrl.length > 0);
        // 현재 라우트의 주소를 가져옵니다.
        // 현재 컨텐이너 주소 안에 있다면 
        if (url.substring(0, this.rootUrl.length) !== this.rootUrl) { return; }
        _log('setActiveViewFromUrl currUrl, url =>', url, this.rootUrl, url.substring(0, this.rootUrl.length));

        //alert(' rootUrl =>' + this.rootUrl + ' url =>' + url)

        let location = '';
        try {
            location = url.substring(this.rootUrl.length + 1);
            let _location = location.split('?');
            location = _location[0];

            //
            const _queryParams: any = this.activeRoute.snapshot.queryParams;
            _log('setActiveViewFromUrl location, _queryParams =>', location, _queryParams);
            //  _valid(_queryParams.locationParams);
            // if (_queryParams.locationParams) { return; }

            let naviObj: BLNavigationLocation = this.navigation.getLocationObject(location, _queryParams.locationParams);
            _log('setActiveViewFromUrl naviObj =>', location, naviObj);
            this.setAcvtiveView(naviObj.id, naviObj.segmentId, naviObj.contentId, naviObj.params);

            // 없으면 채움      => 초기 1회 주소로 왔다면 없음
            // 1개 있으면 교체  -> go로 왔다면 같으니까 문제 없음
            // 1개 이상         -> push와 왔을 경우 임
            if (this.useSyncUrl) {
                if (this.navigation.naviStack.length < 2) {
                    this.navigation.naviStack[0] = naviObj;
                }
            }
        } catch (e) {

        }
    }

    private _initActiveView() {
        _log('BLNavigationPanelContainerView::blOnInit children =>', this.children);
        _valid(this.children != null);
        if (this.useSyncUrl) { return; }    // 주소 기반으로 할 경우 initial을 하게 되면 계속 처음으로 돌아가는 문제가 있음
        if (this.initActiveLocation && this.initActiveLocation.length > 0) {
            //_valid(this.initActiveViewParams);
            this.navigation.go(this.initActiveLocation, this.initActiveViewParams);
        }
    }

    public setAcvtiveView(viewId: string, segmentId?: string, contentId?: string, params?: any) {
        _log('setAcvtiveView viewId, segmentId, contentId, params =>', viewId, segmentId, contentId, params);

        // 새로운 activeView 지정
        let newActiveView = this._getViewById(viewId);
        _valid(newActiveView);

        // 이전에 activeView가 있고 이전것과 다르다면
        if (this.activeView && this.activeView.id !== newActiveView.id) {
            _log('setAcvtiveView oldActiveView =>', this.activeView);
            this.activeView.blOnInactiveView();
        }
        // segmentId가 있으면 activeSegmentId를 넣어줌
        this.activeView = newActiveView;
        if (segmentId) {
            this.activeView.activeSegmentId = segmentId;
        }
        this.activeView.activeContentId = contentId;
        this.activeView.theme = this.theme;
        this.activeView.blOnActiveView(viewId, segmentId, contentId, params);

        // if (this.elNaviContainer) {
        //     this.activeView.containerWidth = this.elNaviContainer.nativeElement.offsetWidth; // 나중에 값은 있는데 여기서는 0나옴
        //     _log('setAcvtiveView containerWidth =>', this.elNaviContainer.nativeElement);
        // }

        //this.adjustHeaderStyle();
    }

    private _getViewById(viewId: string) {
        let view = this.getChildViewById(viewId) as BLPanelComponent;
        _valid(view != null);
        return view;
    }

    // adjustHeaderStyle() {
    //     _log('adjustHeaderStyle _paddingTop =>', this._paddingTop)
    //     this._style['padding-bottom'] = this._paddingBottom + 'px';
    //     if(this.headerStyle == 'mobile' /*|| this.headerStyle == 'small'*/) {
    //         if(this.navigation.hasBack()) {
    //             this._style['padding-top'] = 8 + this._paddingTop + 'px';
    //         } else {
    //             this._style['padding-top'] = 20 + this._paddingTop + 'px'; // 원래는 24px이었음
    //         }
    //     }
    // }
    ///////////////////////////////
    //
    onClickMenuBtn(event: IBLMenuPopupEventParams) {
        this.openMenu.emit(event);
    }

    onClickCloseBtn() {
        this.activeView?.blOnInactiveView();
        this.close.emit();
    }
}

/*
    NavigatorContainer
        panelStack = {} //  panel['note'].push('new-note')  // activePanel = panelStack[activePanelId].last()
        activePanel
        push('note') -> panelStack[activePanelId].push('note');
        back()  ->  panelStack[activePanelId].pop();
        
*/