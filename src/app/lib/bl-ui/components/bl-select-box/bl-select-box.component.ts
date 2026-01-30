// import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';

// @Component({
//     selector: 'bl-selectbox',
//     templateUrl: './bl-select-box.component.html',
//     styleUrls: ['./bl-select-box.component.css']
// })
// export class BLSelectBoxComponent implements AfterViewInit {
//     @ViewChild(TemplateRef) public _template!: TemplateRef<any>;
//     public template: any;

//     @Input() id: string = '';
//     @Input() options: string[] = [];
//     @Input() height: number = 24;
//     @Output() changeValue = new EventEmitter;
    
//     public isOpenBox: boolean = false;
//     public value: string = '';

//     ngAfterViewInit() {
//         this.template = this._template;
//         this.value = this.options[0];
//         console.log('BLSelectBoxComponent::ngAfterViewInit Template =>', this.template);
//     }

//     onClickSelectBox() {
//         this.isOpenBox = !this.isOpenBox;
//         console.log('BLSelectBoxComponent::onClickSelectBox() isOpenBox =>', this.isOpenBox);
//     }

//     onSelectOption(option: any) {
//         this.value = option;
//         this.isOpenBox = false;
//         this.changeValue.emit({id: this.id, value: this.value});
//     }
// }
