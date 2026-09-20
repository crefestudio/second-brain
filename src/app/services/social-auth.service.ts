import { Injectable, inject, signal } from '@angular/core';
import { GoogleAuthProvider, OAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
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
    private ready?: Promise<void>;
    init(): Promise<void> {
        return this.ready ??= new Promise(resolve => {
            auth.languageCode = 'ko';
            onAuthStateChanged(auth, user => {
                const previous = this.account();
                this.account.set(user);
                for (const key of ['member_uid', 'auth_token', 'userId', 'loginedUser', 'forceUserId', 'notionable_verified_purchases']) localStorage.removeItem(key);
                resolve();
                if (previous && previous.uid !== user?.uid) window.location.replace('/login');
            }, () => { this.error.set('로그인 상태를 확인하지 못했습니다. 새로고침해주세요.'); resolve(); });
        });
    }
    async session(): Promise<any> {
        await this.init();
        const user = auth.currentUser;
        if (!user) return null;
        const response = await fetch(`${this.config.functionsBaseUrl}/getAppSession`, {
            method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }
        });
        if (!response.ok) throw new Error('Session lookup failed');
        return auth.currentUser?.uid === user.uid ? response.json() : null;
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
