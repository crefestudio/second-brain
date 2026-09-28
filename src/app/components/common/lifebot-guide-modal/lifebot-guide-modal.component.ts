import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
    selector: 'app-lifebot-guide-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lifebot-guide-modal.component.html',
    styleUrl: './lifebot-guide-modal.component.scss'
})
export class LifebotGuideModalComponent {
    @Input() open = false;
    @Output() closed = new EventEmitter<void>();

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.open) this.close();
    }

    close(): void {
        this.closed.emit();
    }
}
