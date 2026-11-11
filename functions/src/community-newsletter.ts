import {ClubDocument, normalizeDocument, documentHtml, documentText} from './community-document';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
export interface NewsletterMetadata {authorName: string; roomName: string; publishedAt: number}
export function newsletterExcerpt(body: string): string {
    const text = body.replace(/\r\n?/g, '\n').replace(/\[이미지\]/g, '').trim();
    const characters = Array.from(text);
    return characters.length > 700 ? characters.slice(0, 700).join('').trimEnd() + '…' : text;
}
/** Matches the Notionable welcome email's branding; author content is always escaped. */
export function renderCommunityNewsletter(title: string, body: string, url: string, metadata?: NewsletterMetadata, bodyDocument?: ClubDocument | null) {
    const settings = 'https://club.notionable.net/?settings=notifications';
    let excerpt = newsletterExcerpt(body);
    let richHtml = '';
    if (bodyDocument) {
        const source = normalizeDocument(bodyDocument);
        let remaining = 700;
        const shorten = (node: ClubDocument): ClubDocument | null => {
            if (node.type === 'image' || remaining <= 0) return null;
            if (node.type === 'text') {
                const chars = Array.from(node.text || '');
                const text = chars.slice(0, remaining).join('') + (chars.length > remaining ? '…' : '');
                remaining -= Math.min(chars.length, remaining);
                return {...node, text};
            }
            const content = (node.content || []).map(shorten).filter((child): child is ClubDocument => !!child);
            if (['bulletList','orderedList','listItem','blockquote','htmlContainer'].includes(node.type) && !content.length) return null;
            if (['paragraph','htmlParagraph'].includes(node.type) && !content.length) content.push({type:'hardBreak'});
            const styles: Record<string,string> = {paragraph:'margin:0 0 16px',heading:'margin:20px 0 12px;font-weight:700;line-height:1.5',bulletList:'margin:0 0 16px;padding-left:24px',orderedList:'margin:0 0 16px;padding-left:24px',blockquote:'margin:16px 0;padding-left:16px;border-left:3px solid #dce0e5',codeBlock:'white-space:pre-wrap;background:#f5f6f8;padding:16px'};
            return {...node,...(styles[node.type] ? {attrs:{...node.attrs,style:styles[node.type]+';'+(node.attrs?.style || '')}} : {}),...(node.content || content.length ? {content} : {})};
        };
        const shortened = shorten(source) || {type:'doc',content:[{type:'paragraph'}]};
        if (!shortened.content?.length) shortened.content = [{type:'paragraph'}];
        richHtml = documentHtml(shortened);
        excerpt = documentText(shortened).trim();
    }
    const date = metadata && Number.isFinite(metadata.publishedAt) ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'}).format(metadata.publishedAt) : '';
    const details = metadata ? metadata.authorName + ' · ' + metadata.roomName + ' · 게시일 ' + date : '노셔너블 클럽';
    const paragraphs = '<div style="font-size:15px;line-height:1.8;color:#555;word-break:break-word">' + (richHtml || escapeHtml(excerpt).replace(/\n/g, '<br>')) + '</div>';
    return {
        text: '노셔너블 클럽 뉴스레터\n\n' + title + '\n' + details + '\n\n' + excerpt + '\n\n전체 글 읽기: ' + url + '\n\n클럽 메일 수신 설정: ' + settings,
        html: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div style="margin:0;background:#f5f6f8;padding:32px 0;font-family:Arial,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif;color:#24292f;box-sizing:border-box"><div style="width:100%;max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden"><div style="padding:32px 32px 40px">' +
            '<p style="margin:0 0 24px;font-size:18px;font-weight:700"><a href="https://notionable.net" style="color:#ec4899;text-decoration:none">🧠 Notionable</a></p><p style="font-size:13px;color:#64748b">노셔너블 클럽에서 보내드리는 뉴스레터</p>' +
            '<h1 style="margin:0 0 16px;font-size:26px;line-height:1.45;color:#171717">' + escapeHtml(title) + '</h1>' +
            '<p style="margin:0 0 24px;font-size:13px;line-height:1.8;color:#64748b">' + escapeHtml(details) + '</p><div style="height:1px;background:#eceef1;margin:24px 0"></div>' + paragraphs +
            '<p style="margin:28px 0"><a href="' + escapeHtml(url) + '" style="display:inline-block;padding:14px 20px;background:#1d4ed8;border-radius:8px;color:#fff;font-size:15px;font-weight:700;text-decoration:none">전체 글 읽기 →</a></p>' +
            '<div style="border-top:1px solid #eceef1;margin-top:32px;padding-top:24px;font-size:12px;line-height:1.8;color:#6b7280">이 글의 알림 종류에 이메일 수신을 허용한 클럽 회원에게 발송합니다.<br><a href="' + settings + '" style="color:#6b7280">클럽 메일 수신 설정</a></div></div></div></div></body></html>'
    };
}
