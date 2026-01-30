import { Component, ElementRef, OnInit } from '@angular/core';

import { ActivatedRoute, Router} from '@angular/router';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
    selector: 'bl-toast',
    templateUrl: './bl-toast.comopnent.html',
    styleUrls: ['./bl-toast.comopnent.css'],
    animations: [
        trigger('openClose', [
            // ...
            state('open', style({
                bottom: '2rem',
                opacity: 1,
                display: 'block'
            })),
            state('closed', style({
                bottom: '-2rem',
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

export class BLToastComponent implements OnInit  {
    
    public isShowToast: boolean = false;
    public title: string = '';

    constructor(
        private router :Router,
        public activateRouter: ActivatedRoute,
        private elRef: ElementRef
        ) {
    }

    ngOnInit() {
        
    }

    public show(title: string) {
        this.title = title;
        this.isShowToast = true;
        setTimeout(() => {
            this.isShowToast = false;
        }, 3000);
    }
}
