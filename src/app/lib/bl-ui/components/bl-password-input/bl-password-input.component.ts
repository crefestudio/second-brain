import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { BLViewComponent } from 'src/lib/bl-ui/components/bl-view/bl-view.component';
import { BLPanelComponent } from 'src/lib/bl-ui/components/bl-panel/bl-panel.component';
import { CFDate, CFHelper, _log } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-password-input',
    templateUrl: './bl-password-input.component.html',
    styleUrls: ['./bl-password-input.component.css']
})
export class BLPasswordInputComponent {
    public themeResource: any = {
        dark: {
            dotImgOff: 'assets/images/svg/ic_dot_24-black.svg',
            dotImgOn: 'assets/images/svg/ic_dot_24-gray.svg',
            backspace: 'assets/images/svg/ic_backspace_32.svg'
        },
        light: {
            dotImgOff: 'assets/images/svg/ic_dot_24-gray.svg',
            dotImgOn: 'assets/images/svg/ic_dot_24-black.svg',
            backspace: 'assets/images/svg/ic_backspace_32-black.svg'
        }
    }  
    @Input() theme: string = 'dark';
    @Input() set password(value: string) {
        _log('password-input value=>', value );

        this._password = value.split('');
        _log('password-input password=>', this._password );
    }
    @Input() message: string = '비밀번호를 입력해주세요.';
    @Input() warningMessage: string = '';
    @Output() completePassword = new EventEmitter<string>();

    public _password: Array<string> = [];
    public keypad = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['', '0', 'C']
    ];

    constructor(
    ) {
    }

    onClickPassword(value: string) {
        if(value == 'C') {
            this.backspace();
            return;
        } 

        if(this._password.length >= 4) {
            return;
        }
        
        this._password.push(value);

        if(this._password.length == 4) {
            setTimeout(() => {
                this.completePassword.emit(this._password.join(''));
                setTimeout(() => {
                    this._password = [];
                }, 100);    
            }, 100);
        }
    }

    backspace() {
        this._password.pop();
    }
}
