import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommunityMedia, communityVideoUrl } from '../../../../../functions/src/community-media-model';

@Component({selector: 'community-media', standalone: true,
    template: `@for (item of items; track $index) {
        @if (item.type === 'image') { <img [src]="item.src" alt="글에 첨부한 사진" loading="lazy"> }
        @else if (item.video) { <iframe [src]="item.video" title="첨부 동영상" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowfullscreen></iframe> }
    }`,
    styles: [':host{display:grid;gap:16px;margin:16px 0}img{display:block;max-width:100%;max-height:720px;height:auto;margin:auto;border-radius:10px}iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:10px}']})
export class CommunityMediaComponent {
    private readonly sanitizer = inject(DomSanitizer);
    items: Array<CommunityMedia & {video?: SafeResourceUrl}> = [];
    @Input() set media(value: CommunityMedia[] | undefined) {
        this.items = (value || []).map(item => {
            const url = item.type === 'video' ? communityVideoUrl(item.src) : null;
            return {...item, ...(url ? {video: this.sanitizer.bypassSecurityTrustResourceUrl(url)} : {})};
        });
    }
}
