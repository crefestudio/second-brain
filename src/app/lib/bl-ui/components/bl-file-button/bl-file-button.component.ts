import { AfterViewInit, Component, EventEmitter, forwardRef, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { BLButtonComponent } from '../bl-button/bl-button.component';
import { BLMenuPopupComponent } from '../bl-menu-popup/bl-menu-popup.component';
import { BLViewComponent } from '../bl-view/bl-view.component';

@Component({
    selector: 'bl-file-button',
    templateUrl: './bl-file-button.component.html',
    styleUrls: ['./bl-file-button.component.css'],
    providers: [{ provide: BLViewComponent, useExisting: forwardRef(() => BLFileButtonComponent)}]
})
export class BLFileButtonComponent extends BLButtonComponent {
    @Input() acceptFileExts: Array<string> = [];
    @Input() isSelected: boolean = false;
    @Output() selectedFile = new EventEmitter;


    onSelectedFile(event: any) {
        this.selectedFile.emit(event);
    }

    // 같은 파일 안열리는 문제 수정
    onClickFileInput(event: any) {
        event.target.value = null;
    }
}
