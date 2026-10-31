import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    template: `
      <dialog #dialog [attr.aria-label]="title" (cancel)="onCancel($event)">
        <strong>{{ title }}</strong>
        @if (message) { <p>{{ message }}</p> }
        <div class="actions">
          <button type="button" class="cancel" autofocus [disabled]="busy" (click)="cancelled.emit()">취소</button>
          <button type="button" class="confirm" [class.danger]="danger" [disabled]="busy" (click)="confirmed.emit()">{{ confirmLabel }}</button>
        </div>
      </dialog>
    `,
    styles: [`
      dialog { box-sizing: border-box; width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 20px; background: #1c1c1e; color: #fff; border: 1px solid #ffffff14; border-radius: 14px; box-shadow: 0 20px 60px #0008; }
      dialog::backdrop { background: #0009; }
      strong { display: block; font-size: 14px; line-height: 1.6; }
      p { margin: 8px 0 0; color: #b8babc; font-size: 13px; line-height: 1.7; white-space: pre-line; overflow-wrap: anywhere; }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
      button { padding: 8px 12px; border: 0; border-radius: 8px; font: inherit; font-size: 12px; cursor: pointer; }
      .cancel { background: #ffffff14; color: #fff; }
      .confirm { background: #5de4d5; color: #102a27; }
      .danger { background: #ff3b30; color: #fff; }
      button:disabled { opacity: .5; cursor: wait; }
      button:focus-visible { outline: 2px solid #5de4d5; outline-offset: 3px; }
    `]
})
export class ConfirmDialogComponent implements AfterViewInit {
    @Input() title = '';
    @Input() message = '';
    @Input() confirmLabel = '확인';
    @Input() busy = false;
    @Input() danger = false;
    @Output() confirmed = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();
    @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;

    ngAfterViewInit() { this.dialog.nativeElement.showModal(); }
    onCancel(event: Event) {
        event.preventDefault();
        if (!this.busy) this.cancelled.emit();
    }
}
