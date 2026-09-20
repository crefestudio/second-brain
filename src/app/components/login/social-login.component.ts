import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocialAuthService } from '../../services/social-auth.service';

@Component({
    selector: 'app-social-login', standalone: true,
    template: `
        <main>
            <img class="brand-icon" src="/favicon.ico" width="76" height="76" alt="NotionAble App">
            <h1>Notionable App</h1>
            <p class="intro">내 템플릿을 연결하고, 자동화하고, 더 편리하게 관리하세요.<br><br>처음 로그인하면 계정이 자동으로 생성됩니다.</p>
            <div class="login-buttons">
                <button class="google-button" [disabled]="auth.busy()" (click)="login('google')">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.87 0-5.3-1.94-6.17-4.55H2.14v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.83 14.09A6.6 6.6 0 0 1 5.49 12c0-.72.12-1.42.34-2.09V7.07H2.14A11 11 0 0 0 1 12c0 1.77.42 3.45 1.14 4.93l3.69-2.84Z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.86 6.07l3.69 2.84C6.7 7.3 9.13 5.36 12 5.36Z"/></svg>
                    Google로 계속하기
                </button>
                <button class="apple-button" [disabled]="auth.busy() || !auth.appleEnabled" (click)="login('apple')">
                    <span class="apple-mark" aria-hidden="true"></span>
                    {{ auth.appleEnabled ? 'Apple로 계속하기' : 'Apple 로그인 · 준비 중' }}
                </button>
            </div>
            @if (auth.busy()) { <p role="status">로그인 확인 중…</p> }
            @if (auth.error()) { <p role="alert">@for (line of errorLines; track line) { {{ line }}<br> }</p> }
            <p class="hint">기존 구매 내역은 로그인 후 구매 이메일로 연결할 수 있습니다.</p>
            @if (auth.account()) { <button class="continue-button" (click)="continue()">계속하기</button><button class="logout-button" (click)="auth.logout()">로그아웃</button> }
        </main>
    `,
    styles: [`
        :host{display:grid;min-height:100dvh;place-items:center;background:#111214;color:#eee}
        main{width:min(330px,calc(100vw - 48px));text-align:center;padding:40px 24px}
        .brand-icon{display:block;width:76px;height:76px;margin:0 auto 8px;border-radius:50%;object-fit:cover}
        h1{margin:0;color:#fff;font-size:25px;font-weight:700;letter-spacing:-.4px}
        p{color:#a5a8b0;line-height:1.65;font-size:13px}.intro{margin:3px 0 8px}
        .login-buttons{display:grid;gap:9px}
        button{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:42px;padding:9px 14px;border-radius:8px;cursor:pointer;font:600 13px inherit;transition:.18s}
        .google-button{background:rgba(37,99,235,.2);border:1px solid #315da9;color:#74a7f5}.google-button:hover{background:#2d72b5;border-color:#4389ca;color:#fff}
        .google-button svg{width:18px;height:18px;background:#fff;border-radius:50%;padding:2px;box-sizing:border-box}
        .apple-button{background:#2a2d33;border:1px solid #444a54;color:#e8eaed}.apple-button:hover{background:#363a42;border-color:#606775}.apple-mark{font-size:18px;line-height:1}
        button:disabled{opacity:.55;cursor:not-allowed}.continue-button{margin-top:13px;background:rgba(22,163,74,.18);border:1px solid #2f8f55;color:#75d69a}.continue-button:hover{background:#27864c;border-color:#42aa68;color:#fff}.logout-button{margin-top:8px;background:transparent;border:0;color:#9da7b5}
        [role=status],[role=alert]{margin:16px 0 0}.hint{margin-top:22px;font-size:12px}[role=alert]{color:#ffaaaa;overflow-wrap:anywhere}
    `]
})
export class SocialLoginComponent {
    auth = inject(SocialAuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    get errorLines(): string[] {
        const message = this.auth.error();
        return message === '로그인 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
            ? ['로그인 정보를 불러오지 못했습니다.', '잠시 후 다시 시도해주세요.']
            : [message];
    }
    async login(provider: 'google' | 'apple') { if (await this.auth.login(provider)) await this.continue(); }
    async continue() {
        let session: any;
        try { session = await this.auth.session(); }
        catch { this.auth.error.set('계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); return; }
        if (!session) return;
        const path = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
        void this.router.navigateByUrl(/^\/(workspace|mypage)(\/|$)/.test(path) ? path : session.userId ? '/workspace/home' : '/workspace/connect');
    }
}
