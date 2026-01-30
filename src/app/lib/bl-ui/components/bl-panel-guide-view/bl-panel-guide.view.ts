import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'bl-panel-guide-view',
    templateUrl: './bl-panel-guide.view.html',
    styleUrls: ['./bl-panel-guide.view.css'],
})
export class BLPanleGuideView {
    @Input() set message(value: string | undefined) {
        this.settingMessage(value);
    }
    @Input() theme: string = 'dark';
    @Output() close = new EventEmitter;

    public _message: any;
    constructor(
        private sanitizer: DomSanitizer,
    ) {
    }

    settingMessage(message: any) {
        this._message = this.sanitizer.bypassSecurityTrustHtml(message);
    }

    onCloseGuide() {
        this.close.emit();
    }
}
