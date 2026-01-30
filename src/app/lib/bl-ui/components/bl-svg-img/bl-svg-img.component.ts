import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { _log } from 'src/lib/cf-common/cf-common';

@Component({
    selector: 'bl-svg-img',
    templateUrl: './bl-svg-img.component.html',
    styleUrls: ['./bl-svg-img.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class BLSvgImgComponent {
    public _data: any = '';
    
    @Input() width?: number;
    @Input() height?: number;
    @Input() svgWidth?: number;
    @Input() svgHeight?: number; 
    @Input() set data(value: string) {
        this._data = this.sanitizer.bypassSecurityTrustHtml(value);
    }
    
    constructor(private sanitizer: DomSanitizer) {
    }
}
