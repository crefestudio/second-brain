import { Injectable, inject, signal } from '@angular/core';
import { GoogleAuthProvider, OAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';
import { APP_CONFIG } from '../config/app-config.token';

@Injectable({ providedIn: 'root' })
export class SocialAuthService {
    // Enable after the Apple Services ID and signing key are configured in Firebase.
    readonly appleEnabled = false;
    private config = inject(APP_CONFIG);
    readonly account = signal<User | null>(null);
    readonly busy = signal(false);
    readonly error = signal('');
    readonly notice = signal('');
    readonly workspaces = signal<Array<{userId: string; templateId: string; name: string}>>([]);
    readonly activeWorkspaceId = signal('');
    get workspaceName(): string {
        return this.workspaces().find(item => item.userId === this.activeWorkspaceId())?.name || '라이프업';
    }
    private ready?: Promise<void>;
    init(): Promise<void> {
        return this.ready ??= new Promise(resolve => {
            auth.languageCode = 'ko';
            onAuthStateChanged(auth, user => {
                const previous = this.account();
                this.account.set(user);
                // Only obsolete app state is cleared. Widget userId/accessKey entries stay intact.
                try {
                    for (const key of ['member_uid', 'auth_token', 'userId', 'loginedUser', 'forceUserId', 'notionable_verified_purchases']) localStorage.removeItem(key);
                } catch { /* Embedded browsers may block localStorage. Firebase manages its own persistence. */ }
                resolve();
                if (previous && previous.uid !== user?.uid) window.location.replace('/login');
            }, () => { this.error.set('로그인 상태를 확인하지 못했습니다. 새로고침해주세요.'); resolve(); });
        });
    }
    async session(userId?: string, templateId?: string): Promise<any> {
        await this.init();
        const user = auth.currentUser;
        if (!user) return null;
        if (!user.email || !user.emailVerified) throw new Error('이메일 인증이 완료된 계정으로 로그인해주세요.');
        let response: Response | undefined;
        let networkError: unknown;
        // A just-deployed Cloud Run revision can briefly close a request while
        // warming. Retry only that transport failure; server responses remain
        // authoritative and are never retried here.
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                response = await fetch(`${this.config.functionsBaseUrl}/getAppSession`, {
                    method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, templateId })
                });
                break;
            } catch (error) {
                networkError = error;
                if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        if (!response) throw networkError instanceof Error ? networkError : new Error('로그인 정보를 확인하지 못했습니다.');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '로그인 정보를 확인하지 못했습니다.');
        if (auth.currentUser?.uid !== user.uid) return null;
        this.workspaces.set(result.workspaces || []);
        this.activeWorkspaceId.set(result.userId || '');
        return result;
    }
    async switchWorkspace(userId: string): Promise<void> {
        if (this.busy() || userId === this.activeWorkspaceId()) return;
        this.busy.set(true); this.error.set('');
        try { await this.session(userId); window.location.assign('/service'); }
        catch { this.error.set('워크스페이스를 전환하지 못했습니다. 다시 시도해주세요.'); }
        finally { this.busy.set(false); }
    }
    async refreshAccount(): Promise<void> {
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        this.account.set(auth.currentUser);
    }
    private async purchaseRequest(endpoint: string, payload: { email: string; code?: string; templateId?: 'lifeUp' | 'lifeUpScrapbook' }): Promise<any> {
        const response = await fetch(`${this.config.functionsBaseUrl}/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || '인증 요청을 처리하지 못했습니다.');
        return result;
    }
    async requestPurchaseCode(email: string, templateId: 'lifeUp' | 'lifeUpScrapbook' = 'lifeUp'): Promise<boolean> {
        if (this.busy()) return false;
        this.busy.set(true); this.error.set(''); this.notice.set('');
        try {
            await this.purchaseRequest('requestPurchaseLoginCode', { email: email.trim().toLowerCase(), templateId });
            this.notice.set('인증번호를 보냈습니다. 10분 안에 입력해주세요. 재발송은 1분 후 가능합니다.');
            return true;
        } catch (error) {
            this.error.set(error instanceof Error ? error.message : '인증 메일을 보내지 못했습니다.');
            return false;
        } finally { this.busy.set(false); }
    }
    async loginWithPurchase(email: string, code: string, templateId: 'lifeUp' | 'lifeUpScrapbook' = 'lifeUp'): Promise<boolean> {
        if (this.busy()) return false;
        this.busy.set(true); this.error.set(''); this.notice.set('');
        try {
            await this.init();
            if (auth.currentUser) throw new Error('이미 로그인되어 있습니다. 계속하기 또는 로그아웃을 선택해주세요.');
            const result = await this.purchaseRequest('verifyPurchaseLoginCode', {
                email: email.trim().toLowerCase(), code: code.trim(), templateId
            });
            // Never store custom tokens or reuse the widget accessKey. The SDK maintains the session.
            await signInWithCustomToken(auth, result.token);
            await this.session();
            return true;
        } catch (error) {
            this.error.set(error instanceof Error && !('code' in error) ? error.message :
                '로그인을 완료하지 못했습니다. 브라우저 설정을 확인하고 인증번호를 다시 요청해주세요.');
            return false;
        } finally { this.busy.set(false); }
    }
    async login(provider: 'google' | 'apple'): Promise<boolean> {
        if (provider === 'apple' && !this.appleEnabled) {
            this.error.set('Apple 로그인은 준비 중입니다. Google 로그인을 이용해주세요.');
            return false;
        }
        if (this.busy()) return false;
        this.busy.set(true); this.error.set('');
        try {
            const oauth = provider === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
            if (provider === 'google') oauth.setCustomParameters({ prompt: 'select_account' });
            else { oauth.addScope('email'); oauth.addScope('name'); }
            await signInWithPopup(auth, oauth);
            await this.session();
            return true;
        } catch (error: any) {
            const messages: Record<string, string> = {
                'auth/popup-closed-by-user': '로그인을 취소했습니다. 다시 시도할 수 있습니다.',
                'auth/popup-blocked': '팝업을 허용한 후 다시 로그인해주세요.',
                'auth/account-exists-with-different-credential': '다른 로그인 방식으로 가입한 이메일입니다. 기존 로그인 방식을 이용해주세요.',
                'auth/operation-not-allowed': '이 로그인 방식은 아직 준비 중입니다.',
                'auth/unauthorized-domain': '이 주소에서는 로그인을 사용할 수 없습니다. 관리자에게 문의해주세요.',
                'auth/network-request-failed': '네트워크 연결을 확인하고 다시 시도해주세요.',
                'auth/user-disabled': '사용이 중지된 계정입니다. 관리자에게 문의해주세요.'
            };
            this.error.set(messages[error?.code] ?? '로그인 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            return false;
        } finally { this.busy.set(false); }
    }
    async logout(): Promise<void> {
        this.busy.set(true);
        try { await signOut(auth); window.location.replace('/login'); }
        catch { this.error.set('로그아웃하지 못했습니다. 다시 시도해주세요.'); }
        finally { this.busy.set(false); }
    }
}
