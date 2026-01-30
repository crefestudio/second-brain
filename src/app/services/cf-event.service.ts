import { Injectable } from '@angular/core'; 
import { Subject, Observable } from 'rxjs';
import { _flog, _log } from 'src/lib/cf-common/cf-common';

// interface ICFEvent {

// }

@Injectable()
export class CFEventsService {
    private listeners: any = {};
    //private eventsSubject = new Subject();
    constructor() {
        this.listeners = {};

        //this.events = Observable.from(this.eventsSubject);

        // this.eventsSubject.subscribe(
        //     (object: any) => {
        //         if (this.listeners[object.name]) {
        //             for (let listener of this.listeners[object.name]) {
        //                 listener(object.params, object.extParams);
        //             }
        //         }
        //     });
    }

    on(name: string, listener: any, scope?: string) {
        if (!this.listeners[name]) {
            this.listeners[name] = [];
        }
    
        //_log('CFEventsService::on name, listener =>', name, listener, this.listeners);

        // scope가 있으면 scope당 1개의 같은 listener를 받을 수 있음
        let index = -1;
        if (scope) {
            index = this.listeners[name].findIndex((obj: any) => obj.scope && scope == obj.scope && name == obj.name);
        }
        // 이미 있는 이벤트를 삭제
        if (index > -1) {   
            this.listeners[name].splice(index, 1);  
            _log('CFEventsService::on remove this.listeners[name], index =>', this.listeners[name], index);
        }
    
        this.listeners[name].push({listener: listener, scope: scope, name: name});
    }

    // off(name: string, listener: any) {
    //     this.listeners[name] = this.listeners[name].filter((x: any) => x != listener);
    // }

    fire(name: string, params?: any, extParams?: any) {
        _flog(this.fire, arguments);
        _log('CFEventsService::fire this.listeners[name] =>', this.listeners[name]);
        if (this.listeners[name]) {
            for (let obj of this.listeners[name]) {
                obj.listener(params, extParams);
            }
        }
        // this.eventsSubject.next({
        //     name,
        //     params,
        //     extParams
        // });
    }
}