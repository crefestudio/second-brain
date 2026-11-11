import { Component, Input, OnChanges } from '@angular/core';

@Component({
    selector: 'community-avatar', standalone: true,
    host: {'aria-hidden': 'true'},
    template: `@if (photo && !failed) { <img [src]="photo" alt="" (error)="failed = true"> } @else { {{ name.trim().slice(0, 1).toUpperCase() || 'N' }} }`,
    styles: [':host{overflow:hidden}img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}']
})
export class CommunityAvatarComponent implements OnChanges {
    @Input() name = '';
    @Input() photo: string | undefined = '';
    failed = false;
    ngOnChanges() { this.failed = false; }
}
