import { Component, Input } from '@angular/core';

@Component({ selector: 'community-icon', standalone: true, template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="sketch ? 1.25 : 1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">@if (sketch) { <path [attr.d]="paths[name] || paths['grid']" transform="translate(.3 -.25) rotate(1 12 12)" stroke-width=".35" opacity=".65" /><path [attr.d]="paths[name] || paths['grid']" transform="translate(-.35 .3) rotate(-1 12 12)" stroke-width=".45" opacity=".5" /> }<path [attr.d]="paths[name] || paths['grid']" /></svg>`, styles: [':host{display:inline-flex;width:20px;height:20px;flex-shrink:0}svg{width:100%;height:100%}'] })
export class CommunityIconComponent {
    @Input() name = 'grid';
    @Input() sketch = false;
    paths: Record<string, string> = {
        brain: 'M12 5a3 3 0 0 0-5-2 4 4 0 0 0-4 5 4 4 0 0 0 0 7 4 4 0 0 0 5 5 3 3 0 0 0 4-2V5Zm0 0a3 3 0 0 1 5-2 4 4 0 0 1 4 5 4 4 0 0 1 0 7 4 4 0 0 1-5 5 3 3 0 0 1-4-2M7 3v4l2 2M3 8l4 2m-4 5 4-1 2 2m-1 4v-2m9-15v4l-2 2m6-1-4 2m4 5-4-1-2 2m1 4v-2',
        robot: 'M5 7h14a2 2 0 0 1 2 2v10H3V9a2 2 0 0 1 2-2Zm7 0V3m-2 0h4M7 12h1m8 0h1M8 16h8M1 11v5m22-5v5M7 19v3m10-3v3',
        mail: 'M3 5h18v14H3Zm0 0 9 7 9-7',
        instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm9 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm1-5h.01',
        home: 'm3 10 9-7 9 7v10H3Zm6 10v-7h6v7',
        grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
        people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75',
        bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4',
        chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10A9 9 0 0 1 21 11.5ZM7 10h10M7 14h6',
        question: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        compass: 'm16 8-3 5-5 3 3-5ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        megaphone: 'M3 10v4h4l12 5V5L7 10Zm4 4 2 7h3l-2-6M21 9v6',
        calendar: 'M4 5h16v16H4ZM4 10h16M8 3v4m8-4v4',
        hand: 'M8 12V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9a7 7 0 0 1-12 5l-5-6a2 2 0 0 1 3-2l2 2',
        book: 'M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15',
        check: 'm5 12 4 4L19 6',
        spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
        code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
        repeat: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',
        plus: 'M12 5v14M5 12h14',
        arrow: 'm10 5-7 7 7 7M3 12h18',
        close: 'm6 6 12 12M6 18 18 6',
        chevron: 'm8 10 4 4 4-4',
        heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
        edit: 'm16 3 5 5-12 12-6 1 1-6ZM13 6l5 5',
        lock: 'M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2',
        logout: 'M9 3H3v18h6m7-16 5 7-5 7M8 12h13',
        menu: 'M4 6h16M4 12h16M4 18h16',
        link: 'm10 13 4-4m-6 1-3 3a4 4 0 0 0 6 6l3-3m-4-8 3-3a4 4 0 0 1 6 6l-3 3'
    };
}
