export function purchaseEmailError(identity: { email?: string; email_verified?: boolean }, email?: string): string | null {
    if (!identity.email || !identity.email_verified) return '이메일 인증이 완료된 계정으로 로그인해주세요.';
    if (email !== undefined && identity.email.trim().toLowerCase() !== email.trim().toLowerCase())
        return '구매 인증은 현재 라이프봇 계정의 이메일과 구매 이메일이 다르면 진행할 수 없습니다. 라이프봇에서 로그아웃한 후 다시 진행해 주세요.';
    return null;
}
