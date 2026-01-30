// import { Injectable } from '@angular/core'; 
// import { Subject, Observable } from 'rxjs';

// // interface ICFEvent {

// // }

// @Injectable()
// export class CFEventsService {
//     private listeners: any = {};
//     private eventsSubject = new Subject();
//     constructor() {
//         this.listeners = {};

//         //this.events = Observable.from(this.eventsSubject);

//         this.eventsSubject.subscribe(
//             (object: any) => {
//                 if (this.listeners[object.name]) {
//                     for (let listener of this.listeners[object.name]) {
//                         listener(object.params, object.extParams);
//                     }
//                 }
//             });
//     }

//     on(name: string, listener: any) {
//         if (!this.listeners[name]) {
//             this.listeners[name] = [];
//         }

//         this.listeners[name].push(listener);
//     }

//     off(name: string, listener: any) {
//         this.listeners[name] = this.listeners[name].filter((x: any) => x != listener);
//     }

//     fire(name: string, params?: any, extParams?: any) {
//         this.eventsSubject.next({
//             name,
//             params,
//             extParams
//         });
//     }
// }