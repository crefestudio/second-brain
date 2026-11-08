const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));

/** Only administrator-authored text is included; never interpret author input as HTML. */
export function renderCommunityNewsletter(title: string, body: string, url: string) {
    const settings = 'https://community.notionable.net/community?settings=notifications';
    const paragraphs = body.split(/\n\s*\n/).map(p => '<p style="margin:0 0 20px;line-height:1.8;word-break:break-word">' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
    return {
        text: title + '\n\n' + body + '\n\n커뮤니티에서 보기: ' + url + '\n\n메일 수신 설정 변경: ' + settings,
        html: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
            '<body style="margin:0;background:#f4f5f7;color:#202124;font-family:Arial,Malgun Gothic,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">' +
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:36px 28px">' +
            '<p style="font-size:13px;letter-spacing:2px;color:#64748b;margin:0 0 24px">LIFEUP COMMUNITY</p>' +
            '<h1 style="font-size:26px;line-height:1.45;margin:0 0 28px">' + escapeHtml(title) + '</h1>' +
            '<div style="font-size:16px">' + paragraphs + '</div>' +
            '<p style="margin:32px 0"><a href="' + escapeHtml(url) + '" style="display:inline-block;background:#202124;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">커뮤니티에서 이야기 나누기</a></p>' +
            '<p style="border-top:1px solid #e5e7eb;padding-top:24px;font-size:12px;line-height:1.7;color:#64748b">라이프업 커뮤니티 메일 알림을 허용한 회원에게 보내드립니다.<br><a href="' + settings + '" style="color:#64748b">메일 수신 설정 변경</a></p>' +
            '</td></tr></table></td></tr></table></body></html>'
    };
}
