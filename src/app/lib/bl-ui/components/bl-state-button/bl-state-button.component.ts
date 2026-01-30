import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { _log } from 'src/lib/cf-common/cf-common';
import { BLButtonComponent } from '../bl-button/bl-button.component';

@Component({
    selector: 'bl-state-button',
    templateUrl: './bl-state-button.component.html',
    styleUrls: ['./bl-state-button.component.css']
})

export class BLStateButtonComponent extends BLButtonComponent implements AfterViewInit {
    @ViewChild(TemplateRef) public _template!: TemplateRef<any>;

    @Input() height: number = 32;
    @Input() width: number = 32;
    @Input() states: Array<any> = [{
        value: '',
        img: ''
    }];
    @Input() set state(value: string | undefined) {
        if (!value) { return; }

        let idx = 0;
        for(let _state of this.states) {
            if (_state.value == value) {
                this.currentState = _state;
                this._currIndex = idx;
                break;
            }
            idx++;
        }
        _log('BLStateButtonComponent value =>', this.states, this.currentState, this._currIndex);        
    }

    @Output() changeState = new EventEmitter;

    public currentState = {
        value: '',
        img: ''
    }

    private _currIndex: number = 0;

    // public value: string = '';
    // public img: string = '';

    // public state = [
    //     {
    //         value: 'off',
    //         img: ''
    //     },
    //     {
    //         value: 'on',
    //         img: ''
    //     },
    // ];

    override blOnInit() {
        this.template = this._template;

        // if(this.toggleState) {
        //     this.state = this.toggleState;
        // } else {
        //     this.state[0].img = this.toggleState.img;
        //     this.state[1].img = this.toggleState.img;
        // }

        //this._currIndex = 0;
        setTimeout(() => {
            this.currentState = this.states[this._currIndex];
            console.log('ngAfterViewInit() this.template => ', this.template);
        },0);
    }

    override onClick(event: any) {
        super.onClick(event);
        this._currIndex++;
        if(this._currIndex >= this.states.length) {
            this._currIndex = 0;
        }
        this.currentState = this.states[this._currIndex];
        console.log('onToggle() currentState => ', this.currentState);

        this.changeState.emit({id: this.id, state: this.currentState.value});
    }
}
