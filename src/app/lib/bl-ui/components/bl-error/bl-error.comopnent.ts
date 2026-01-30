import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { trigger, state, style, animate, transition } from '@angular/animations';
import { _log } from '../../../cf-common/cf-common'; 

@Component({
    standalone: true,
    imports: [CommonModule],

    selector: 'bl-error',
    templateUrl: './bl-error.comopnent.html',
    styleUrls: ['./bl-error.comopnent.css'],
    animations: [
        trigger('openClose', [
            // ...
            state('open', style({
                bottom: '0',
                opacity: 1,
                display: 'block'
            })),
            state('closed', style({
                bottom: '-1.5rem',
                opacity: 0,
                display: 'none'
            })),
            transition('open => closed', [
                animate('.2s ease-out')
            ]),
            transition('closed => open', [
                animate('.2s ease-in')
            ]),
        ]),
    ]
})

export class BLErrorComponent  {
    public isShowErrorMessage: boolean = false;    
    public isShowError: boolean = false;
    public message: string = '';

    constructor(
    ) {
    }

    onReload(event: any) {
        event.preventDefault();
        window.location.reload();
    }

    public messages: Array<string> = [];
    public show(message: string, isShowErrorMessage: boolean) {
        this.isShowErrorMessage = isShowErrorMessage;
        _log("error message => ", message);
        this.messages.push(message);
        this.message = message;
        this.isShowError = true;
    }
    
    public hide() {
        this.isShowError = false;
    }
}
