/** Restricted, portable document format shared by the editor and API. No arbitrary HTML. */
export interface ClubDocument { type: string; text?: string; attrs?: {level?: number; start?: number; style?: string; src?: string; alt?: string; title?: string; width?: number; height?: number}; marks?: Array<{type: string; attrs?: {href?: string; style?: string}}>; content?: ClubDocument[] }
export function imageUrl(value: unknown): string {
    if (typeof value !== 'string' || value.length > 4096 || !/^https:\/\//i.test(value) || /\s/.test(value) || Array.from(value).some(c => c.charCodeAt(0) < 32)) return '';
    try { const url = new URL(value); return url.hostname && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
// Only presentation properties with literal values and numeric colors. No URLs or positioning.
export function normalizeStyle(value: unknown): string {
    if (typeof value !== 'string') return '';
    const allowed = /^(color|background|background-color|font-family|font-size|font-weight|font-style|line-height|text-align|text-decoration|word-break|overflow-wrap|white-space|box-sizing|width|max-width|min-width|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|border(?:-(?:top|right|bottom|left))?(?:-(?:width|style|color))?|border-radius)$/;
    return value.split(';').map(part => {
        const colon = part.indexOf(':');
        const property = part.slice(0, colon).trim().toLowerCase();
        const literal = part.slice(colon + 1).trim();
        const checked = literal.replace(/\b(?:rgb|rgba|hsl|hsla)\([\d\s.,%/+-]+\)/gi, 'color');
        if (colon < 0 || !allowed.test(property) || !literal || literal.length > 256 || !/^[a-zA-Z0-9\s#%.,'"-]+$/.test(checked) || Array.from(literal).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return '';
        return property + ':' + literal;
    }).filter(Boolean).join(';');
}
export function plainDocument(body: string): ClubDocument {
    return {type: 'doc', content: body.split('\n').map(text => ({type: 'paragraph', ...(text ? {content: [{type: 'text', text}]} : {})}))};
}
export function documentText(doc: ClubDocument): string {
    if (doc.type === 'text') return doc.text || '';
    if (doc.type === 'hardBreak') return '\n';
    if (doc.type === 'image') return doc.attrs?.alt || '[이미지]';
    const inline = ['paragraph', 'htmlParagraph', 'heading', 'codeBlock'].includes(doc.type);
    return (doc.content || []).map(documentText).join(inline ? '' : '\n');
}
export function normalizeDocument(value: unknown): ClubDocument {
    if (JSON.stringify(value)?.length > 180000) throw new Error('본문 서식이 너무 큽니다.');
    let count = 0;
    const block = ['paragraph', 'htmlParagraph', 'htmlContainer', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule'];
    function node(value: unknown, parent: string, depth: number): ClubDocument {
        if (++count > 4000 || depth > 20 || !value || typeof value !== 'object') throw new Error('본문 서식을 확인해주세요.');
        const n = value as ClubDocument;
        const allowed = parent === '' ? ['doc'] : ['doc', 'htmlContainer', 'blockquote', 'listItem'].includes(parent) ? block : ['bulletList', 'orderedList'].includes(parent) ? ['listItem'] : parent === 'codeBlock' ? ['text'] : ['paragraph', 'htmlParagraph', 'heading'].includes(parent) ? ['text', 'hardBreak', 'image'] : [];
        if (!allowed.includes(n.type)) throw new Error('지원하지 않는 본문 서식입니다.');
        const out: ClubDocument = {type: n.type};
        if (n.type === 'text') {
            if (typeof n.text !== 'string' || !n.text) throw new Error('본문을 확인해주세요.');
            out.text = n.text;
        } else if (n.text !== undefined) throw new Error('본문 서식을 확인해주세요.');
        if (n.type === 'heading') out.attrs = {level: [1, 2, 3].includes(Number(n.attrs?.level)) ? Number(n.attrs?.level) : 2};
        if (n.type === 'orderedList') out.attrs = {start: Number.isInteger(n.attrs?.start) && Number(n.attrs?.start) > 0 && Number(n.attrs?.start) < 10000 ? Number(n.attrs?.start) : 1};
        if (n.type === 'image') {
            const src = imageUrl(n.attrs?.src);
            if (!src) throw new Error('이미지는 HTTPS 주소를 사용해주세요.');
            out.attrs = {src};
            for (const key of ['alt', 'title'] as const) {
                const label = n.attrs?.[key];
                if (typeof label === 'string') out.attrs[key] = label.slice(0, 1000);
            }
            for (const key of ['width', 'height'] as const) {
                const size = n.attrs?.[key];
                if (typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= 10000) out.attrs[key] = size;
            }
        }
        const style = normalizeStyle(n.attrs?.style);
        if (style && block.concat('listItem', 'image').includes(n.type)) out.attrs = {...out.attrs, style};
        if (n.content !== undefined) {
            if (!Array.isArray(n.content)) throw new Error('본문 서식을 확인해주세요.');
            out.content = n.content.map(child => node(child, n.type, depth + 1));
        }
        if (['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem'].includes(n.type) && !out.content?.length) throw new Error('본문 구조를 확인해주세요.');
        if (n.type === 'listItem' && out.content?.[0].type !== 'paragraph') throw new Error('목록 서식을 확인해주세요.');
        if (n.marks !== undefined) {
            if (!['text', 'hardBreak'].includes(n.type) || !Array.isArray(n.marks) || n.marks.length > 7) throw new Error('본문 서식을 확인해주세요.');
            out.marks = n.marks.map(mark => {
                if (!['bold', 'italic', 'strike', 'underline', 'code', 'link', 'styledSpan'].includes(mark.type)) throw new Error('지원하지 않는 글자 서식입니다.');
                const style = normalizeStyle(mark.attrs?.style);
                if (mark.type !== 'link') return {type: mark.type, ...(style ? {attrs: {style}} : {})};
                const href = mark.attrs?.href || '';
                if (href.length > 2048 || !/^(https?:\/\/|mailto:)/i.test(href) || /\s/.test(href) || Array.from(href).some(c => c.charCodeAt(0) < 32)) throw new Error('링크는 http, https 또는 mailto 주소를 사용해주세요.');
                return {type: 'link', attrs: {href, ...(style ? {style} : {})}};
            });
        }
        return out;
    }
    const result = node(value, '', 0);
    if (documentText(result).length > 12000) throw new Error('본문은 12,000자까지 입력할 수 있습니다.');
    return result;
}
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function documentHtml(value: ClubDocument): string {
    const doc = normalizeDocument(value);
    function render(n: ClubDocument): string {
        if (n.type === 'text') {
            let text = escapeHtml(n.text || '');
            for (const mark of n.marks || []) {
                const tag = ({bold: 'strong', italic: 'em', strike: 's', underline: 'u', code: 'code', styledSpan: 'span'} as Record<string, string>)[mark.type];
                const style = mark.attrs?.style ? ' style="' + escapeHtml(mark.attrs.style) + '"' : '';
                text = mark.type === 'link' ? '<a href="' + escapeHtml(mark.attrs?.href || '') + '" target="_blank" rel="noopener noreferrer"' + style + '>' + text + '</a>' : '<' + tag + style + '>' + text + '</' + tag + '>';
            }
            return text;
        }
        const content = (n.content || []).map(render).join('');
        const style = n.attrs?.style ? ' style="' + escapeHtml(n.attrs.style) + '"' : '';
        if (n.type === 'doc') return content;
        if (n.type === 'hardBreak') return '<br>';
        if (n.type === 'image') {
            const attrs = n.attrs || {};
            return '<img src="' + escapeHtml(attrs.src || '') + '" alt="' + escapeHtml(attrs.alt || '') + '"' +
                (attrs.title ? ' title="' + escapeHtml(attrs.title) + '"' : '') +
                (attrs.width ? ' width="' + attrs.width + '"' : '') + (attrs.height ? ' height="' + attrs.height + '"' : '') +
                ' loading="lazy" referrerpolicy="no-referrer"' + style + '>';
        }
        if (n.type === 'horizontalRule') return '<hr' + style + '>';
        if (n.type === 'codeBlock') return '<pre' + style + '><code>' + content + '</code></pre>';
        const tag = n.type === 'heading' ? 'h' + n.attrs?.level : ({paragraph: 'p', htmlParagraph: 'div', htmlContainer: 'div', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote'} as Record<string, string>)[n.type];
        return '<' + tag + (n.type === 'orderedList' ? ' start="' + n.attrs?.start + '"' : '') + style + '>' + content + '</' + tag + '>';
    }
    return render(doc);
}
