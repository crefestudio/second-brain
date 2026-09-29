import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';

@Component({
    selector: 'app-lifebot-guide-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lifebot-guide-modal.component.html',
    styleUrl: './lifebot-guide-modal.component.scss'
})
export class LifebotGuideModalComponent implements AfterViewChecked {
    @Input() open = false;
    @Input() initialSection = 'backup-method';
    @Output() closed = new EventEmitter<void>();
    @ViewChild('guideContent') private guideContent?: ElementRef<HTMLElement>;
    private initializedSection = '';
    activeSection = '';

    ngAfterViewChecked(): void {
        if (!this.open) {
            this.initializedSection = '';
            return;
        }
        if (!this.guideContent || this.initializedSection === this.initialSection) return;
        const section = this.guideContent.nativeElement.querySelector<HTMLElement>(`#${this.initialSection}`);
        if (!section) return;
        section.scrollIntoView({ block: 'start' });
        this.initializedSection = this.initialSection;
        this.activeSection = this.initialSection;
    }

    selectSection(event: Event, sectionId: string): void {
        event.preventDefault();
        const section = this.guideContent?.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
        if (!section) return;

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.activeSection = sectionId;
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.open) this.close();
    }

    close(): void {
        this.initializedSection = '';
        this.activeSection = '';
        this.closed.emit();
    }
}
