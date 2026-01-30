import { HostListener, Injectable } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { environment } from 'src/environments/environment';

@Injectable()
export class BLResponsiveService {
    public _isMobile: boolean = false;
    public _isDesktop: boolean = false;
    public _isTablet: boolean = false;
    
    constructor(
        // private deviceService: DeviceDetectorService, 
    ) {
        //let _isMobile = /iPhone|iPod|Android/i.test(navigator.userAgent); // iPad
        // // this._isTablet = /iPad/i.test(navigator.userAgent);
        // this._isDesktop = !this._isMobile && !this._isTablet;
        // let mobile: boolean = /iPhone|iPod|Android/i.test(navigator.userAgent);
        // let iPad = /iPad/i.test(navigator.userAgent);
        
        // this._isDesktop = !/Mobile|android/i.test(navigator.userAgent);
        // this._isMobile = mobile && width < 1024;
        // this._isTablet = mobile && width >= 1024 || iPad;
        this.doCheck();
    }

    doCheck() {
        let width = window.innerWidth;
        this._isMobile = width <= 1024;
        this._isDesktop = width > 1024;

        // 만약 isOnlyMobileInIOS true이면 항상 모바일
        if (environment.responsiveServiceConfig && environment.responsiveServiceConfig.isOnlyMobileInIOS) {
            //console.log('doCheck =>', this.isIOS())
            if (this.isIOS()) {
                this._isMobile = true;
                this._isDesktop = false;
            } 
        }
    }

    public isIOS(): boolean {
        // const userAgent = navigator.userAgent;
        // return /iPhone|iPad|iPod/i.test(userAgent);
        return [
            'iPad Simulator',
            'iPhone Simulator',
            'iPod Simulator',
            'iPad',
            'iPhone',
            'iPod',
            // 'MaxIntel'
          ].includes(navigator.platform)
          // iPad on iOS 13 detection
          || (navigator.userAgent.includes("iPhone") || (navigator.userAgent.includes("Mac") && 
            "ontouchend" in document))
    }

    public isMobile() {
        this.doCheck();
        return this._isMobile;
    }

    public isDesktop() {
        this.doCheck();
        return this._isDesktop;
    }

    // public isTablet() {
    //     let width = window.innerWidth;
    //     this._isMobile = width <= 1024;
    //     this._isDesktop = width > 1024;
    //     return this._isTablet;
    // }

}
