import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-store-redirect',
    standalone: true,
    template: `<main><p>{{ message }}</p></main>`,
    styles: ['main{min-height:100vh;display:grid;place-items:center;padding:24px;color:#e5e7eb;background:#171717;font-family:Arial,sans-serif}p{margin:0;text-align:center}']
})
export class StoreRedirectComponent implements OnInit {
    message = '상품 페이지로 이동 중입니다…';
    constructor(private readonly route: ActivatedRoute) {}

    ngOnInit(): void {
        const content = this.route.snapshot.queryParamMap.get('content');
        if (!content || !this.isLatpeedProductUrl(content)) {
            this.message = '올바른 래피드 상품 주소가 필요합니다.';
            return;
        }
        window.location.replace(content);
    }

    private isLatpeedProductUrl(value: string): boolean {
        try {
            const url = new URL(value);
            return (url.hostname === 'www.latpeed.com' || url.hostname === 'latpeed.com') && url.pathname.startsWith('/products/');
        } catch { return false; }
    }
}
