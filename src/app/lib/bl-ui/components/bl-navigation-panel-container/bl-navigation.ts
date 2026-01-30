import { EventEmitter } from "@angular/core";
import { _log, _valid } from "src/lib/cf-common/cf-common";

export interface BLNavigationLocation {
    id: string;
    segmentId?: string;
    contentId?: string;
    params?: any;
}
export class BLNavigation {
    public naviStack: Array<BLNavigationLocation> = [];
    public event = new EventEmitter<BLNavigationLocation>();

    get id() {
        _valid(this.naviStack.length !== 0);
        return this.naviStack[this.naviStack.length-1].id;
    }

    // location: panelId/segmentId/contentId    params
    go(location: string, params?: any) {
        let obj: BLNavigationLocation = this.getLocationObject(location, params);
        _log('bl-navigation go location, obj =>', location, obj);
        this.naviStack = [obj];
        this.event.emit(obj);
    }

    // 현재 위치의 교체
    set(location: string, params?: any) {
        let obj: BLNavigationLocation = this.getLocationObject(location, params);
        this.naviStack[this.naviStack.length-1] = obj;
        _log('bl-navigation set naviStack, location, obj =>', this.naviStack, location, obj);
        this.event.emit(obj);
    }

    back() {
        if (this.naviStack.length < 2) {
            return;
        }
        this.naviStack.pop();
        this.event.emit(this.naviStack[this.naviStack.length-1]);
    }

    push(location: string, params?: any) {
        let obj: BLNavigationLocation = this.getLocationObject(location, params);
        this.naviStack.push(obj);
        _log('BLNavigation::push naviStack =>', this.naviStack)
        this.event.emit(obj);
    }

    hasBack(): boolean {
        //_log('BLNavigation::hasBack =>', this.naviStack)
        return this.naviStack.length > 1;
    } 

    public getLocationObject(location: string, params?: any): BLNavigationLocation {
        let _location = location.split('/');
        let panelId = _location[0];
        let segmentId =  _location[1] && _location[1] !== 'undefined'? _location[1] : undefined;
        let contentId =  _location[2] && _location[2] !== 'undefined'? _location[2] : undefined;
        
        let _params;// = params ? JSON.parse(params) : undefined;
        if(params) {
            try {
                _params = JSON.parse(params);
            } catch {
                _params = params;
            }   
        }        
        let obj: BLNavigationLocation = {id: panelId, segmentId: segmentId, contentId: contentId, params: _params};
        return obj;
    }

    // panelContainer의 url규칙 
    // panelId/segmentId/contentId?key='---'
    public getLocation(obj: BLNavigationLocation, exceptParams: boolean = false): string {
        let location = obj.id;
        if (obj.segmentId) {
            location += '/' + obj.segmentId;
        }
        if (obj.contentId) {
            location += '/' + obj.contentId;
        }
        // params를 모두 수용할 수 없어서 params에 _key 필드를 담은 것으로 제한한다.
        if (!exceptParams && obj.params) {
            location += '?locationParams=' + obj.params; //+ JSON.stringify(obj.params);
        }
        return location;
    }
}
