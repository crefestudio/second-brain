// import { AfterViewInit, Component, ContentChild, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
// import { BLPopupComponent } from '../bl-popup/bl-popup.component';

// @Component({
//     selector: 'bl-popupButton',
//     templateUrl: './bl-popup-button.component.html',
//     styleUrls: ['./bl-popup-button.component.css']
// })
// export class BLPopupButtonComponent implements AfterViewInit {
//     @Input() data: any;
//     @Input() isMobileViewMode: boolean = false;

//     @ContentChild('buttonPopupBody') buttonPopupBody!: TemplateRef<any>;
//     @ViewChild('popup', { read: BLPopupComponent }) popup!: BLPopupComponent;

//     public isShow: boolean = false;

//     ngAfterViewInit(): void {
//         if(this.data.template) {
//             this.buttonPopupBody = this.data.template;
//             console.log('popupButton this.data.template =>', this.data.template);
//         }
//     }

//     onChangeValue(event: any) {
//         if(event.state == 'on') {
//             this.isShow = true;
//         } else {
//             this.isShow = false;
//         }
//     }
// }
