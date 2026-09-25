import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../../config/app-config.token';

@Component({ selector: 'app-unsubscribe', standalone: true, imports: [FormsModule], templateUrl: './unsubscribe.component.html', styleUrl: './unsubscribe.component.scss' })
export class UnsubscribeComponent {
    email = ''; phone = ''; isSubmitting = false; message = ''; error = '';
    private readonly baseUrl = inject(APP_CONFIG).functionsBaseUrl;
    private readonly router = inject(Router);
    async submit(): Promise<void> {
        if (this.isSubmitting || (!this.email.trim() && !this.phone.trim())) { this.error = '이메일 또는 휴대폰 번호를 입력해주세요.'; return; }
        this.isSubmitting = true; this.error = ''; this.message = '';
        try {
            const response = await fetch(`${this.baseUrl}/unsubscribeMarketing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: this.email.trim(), phone: this.phone.trim() }) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || '수신 차단을 완료하지 못했습니다.');
            if (result.member) { await this.router.navigate(['/login'], { queryParams: { returnUrl: '/mypage/profile' } }); return; }
            this.message = '앞으로 노셔너블의 마케팅 안내를 보내드리지 않습니다.';
        } catch (error) { this.error = error instanceof Error ? error.message : '수신 차단을 완료하지 못했습니다.'; }
        finally { this.isSubmitting = false; }
    }
}
