export function normalizeYoutubeHandle(value: unknown): string {
    if (typeof value !== 'string') return '';
    const handle = value.trim().toLowerCase();
    return handle && !handle.startsWith('@') ? '@' + handle : handle;
}

// Basic input validation only; this does not verify a comment with YouTube.
export function isYoutubeCommentHandle(value: unknown): value is string {
    const handle = normalizeYoutubeHandle(value);
    return typeof value === 'string' && /^@[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N}._·-]*[\p{L}\p{M}\p{N}])?$/u.test(handle)
        && Array.from(handle).length <= 101;
}

export function normalizeGiftEmail(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isGiftEmail(value: unknown): boolean {
    const email = normalizeGiftEmail(value);
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function giftApplicationError(body: {
    youtubeHandle?: unknown; email?: unknown; subscribedAndLiked?: unknown; commented?: unknown;
}): string | null {
    if (!isYoutubeCommentHandle(body.youtubeHandle)) return '유튜브 댓글에 표시된 @아이디를 입력해 주세요.';
    if (!isGiftEmail(body.email)) return '이메일 주소를 확인해 주세요.';
    if (body.subscribedAndLiked !== true || body.commented !== true) return '구독·좋아요와 응원 댓글 작성 여부를 모두 체크해 주세요.';
    return null;
}
