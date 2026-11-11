import type {firestore} from 'firebase-admin';
import {ClubDocument, documentHtml, imageUrl} from './community-document';
import {CommunityMedia, communityVideoUrl} from './community-media-model';
import {COMMUNITY_ROOMS, isCommunityRoomVisible} from './community-model';
import {withdrawnCommunityAuthors} from './community-withdrawal';

/** Only an explicitly published snapshot may be served without membership. */
export interface BlogArticle {
    id: string; title: string; body: string; bodyDocument: ClubDocument | null;
    authorId: string; authorName: string; roomId: string; media: CommunityMedia[];
    publishedAt: number; updatedAt: number; sourceVersion: number; active: boolean;
}
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const iso = (time: number) => new Date(time).toISOString();
const date = (time: number) => new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', dateStyle: 'long'}).format(time);
const description = (body: string) => Array.from(body.replace(/\s+/g, ' ').trim()).slice(0, 160).join('');
export const blogArticleUrl = (base: string, id: string) => base.replace(/\/$/, '') + '/' + encodeURIComponent(id);

function page(title: string, summary: string, url: string, content: string, schema?: object) {
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · 노셔너블</title><meta name="description" content="${escape(summary)}"><link rel="canonical" href="${escape(url)}">
<meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="노셔너블">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(summary)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${schema ? 'article' : 'website'}">
${schema ? '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>' : ''}
<style>body{margin:0;background:#faf9f6;color:#232323;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.85;word-break:keep-all;overflow-wrap:anywhere}header,main,footer{max-width:760px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #e6e3dd}a{color:#305dab;text-underline-offset:4px}header a{color:inherit;text-decoration:none}header strong{color:#c72d79}h1{font-size:clamp(28px,5vw,40px);line-height:1.4;margin:24px 0}h2,h3{line-height:1.5;margin-top:1.6em}.meta{color:#666;font-size:14px}.article-body{margin:36px 0;font-size:17px}.article-body p{min-height:1em;margin:0 0 1em}.article-body img,figure img{max-width:100%;height:auto}.article-body pre{overflow:auto;white-space:pre-wrap;background:#f0efeb;padding:16px}.article-body blockquote{border-left:3px solid #cfcbc2;margin-left:0;padding-left:20px}.article-body div{max-width:100%;box-sizing:border-box}figure{margin:24px 0}iframe{width:100%;aspect-ratio:16/9;border:0}.post-list{list-style:none;padding:0}.post-list li{padding:24px 0;border-bottom:1px solid #e6e3dd}.post-list h2{margin:0 0 8px;font-size:23px}.post-list p{margin:8px 0}.post-list a{text-decoration:none}footer{border-top:1px solid #e6e3dd;font-size:14px;color:#666}.back{display:inline-block;margin:24px 0}</style></head>
<body><header><a href="https://notionable.net"><strong>Notionable</strong></a><a href="https://club.notionable.net/">노셔너블 클럽</a></header><main>${content}</main><footer>더 나은 일상을 만드는 노셔너블 · <a href="https://notionable.net">홈페이지</a></footer></body></html>`;
}

export function renderBlogArticle(article: BlogArticle, base: string): string {
    const url = blogArticleUrl(base, article.id);
    const room = COMMUNITY_ROOMS.find(r => r.id === article.roomId)?.name || '';
    const html = article.bodyDocument ? documentHtml(article.bodyDocument).replace(/<(\/?)h1(?=[ >])/g, '<$1h2') : '<p>' + escape(article.body).replace(/\r?\n/g, '<br>') + '</p>';
    const media = (article.media || []).map(item => {
        if (item.type === 'image') { const src = imageUrl(item.src); return src ? `<figure><img src="${escape(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></figure>` : ''; }
        const src = communityVideoUrl(item.src);
        return src ? `<iframe src="${escape(src)}" title="${escape(article.title)} 관련 동영상" loading="lazy" allowfullscreen></iframe>` : '';
    }).join('');
    const schema = {'@context':'https://schema.org', '@type':'BlogPosting', headline:article.title, description:description(article.body),
        mainEntityOfPage:url, url, inLanguage:'ko-KR', datePublished:iso(article.publishedAt), dateModified:iso(article.updatedAt),
        author:{'@type':'Person',name:article.authorName}, publisher:{'@type':'Organization',name:'노셔너블',url:'https://notionable.net'}, articleSection:room};
    return page(article.title, description(article.body), url, `<nav aria-label="경로"><a href="${escape(base)}">노셔너블 블로그</a> / ${escape(room)}</nav><article><h1>${escape(article.title)}</h1><p class="meta">${escape(article.authorName)} · ${escape(room)} · 발행 <time datetime="${iso(article.publishedAt)}">${date(article.publishedAt)}</time>${article.updatedAt !== article.publishedAt ? ` · 수정 <time datetime="${iso(article.updatedAt)}">${date(article.updatedAt)}</time>` : ''}</p><div class="article-body">${html}${media}</div></article><a class="back" href="${escape(base)}">← 전체 글 보기</a>`, schema);
}

export function renderBlogIndex(articles: BlogArticle[], base: string, next?: string): string {
    return page('노셔너블 블로그', '노션, AI와 자동화로 더 나은 일상을 만드는 경험과 활용 방법을 나눕니다.', base,
        '<h1>노셔너블 블로그</h1><p>더 나은 일상을 만드는 경험과 방법을 나눕니다.</p><ul class="post-list">' + articles.map(a => `<li><h2><a href="${escape(blogArticleUrl(base, a.id))}">${escape(a.title)}</a></h2><p class="meta">${escape(a.authorName)} · <time datetime="${iso(a.publishedAt)}">${date(a.publishedAt)}</time></p><p>${escape(description(a.body))}</p></li>`).join('') + '</ul>' + (articles.length ? '' : '<p>곧 새로운 이야기를 전해드리겠습니다.</p>') + (next ? `<a href="${escape(base)}?after=${encodeURIComponent(next)}">다음 글 보기 →</a>` : ''));
}

/** Recheck the source on every request, including lists and sitemap, to honor deletion/withdrawal. */
export async function visibleBlogArticles(db: firestore.Firestore, snapshots: firestore.QueryDocumentSnapshot[] | firestore.DocumentSnapshot[]): Promise<BlogArticle[]> {
    const published = snapshots.filter(d => d.exists && d.get('active') === true);
    if (!published.length) return [];
    const sources = await db.getAll(...published.map(d => db.collection('communityPosts').doc(d.id)));
    const withdrawn = await withdrawnCommunityAuthors(db, sources.map(d => d.get('authorId') || ''));
    return published.filter((d, i) => sources[i].exists && sources[i].get('visible') === true && sources[i].get('isPrivate') !== true && isCommunityRoomVisible(sources[i].get('roomId')) && !withdrawn.has(sources[i].get('authorId')))
        .map(d => ({...d.data(), id:d.id} as BlogArticle));
}

export function renderBlogSitemap(articles: BlogArticle[], base: string) {
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + escape(base) + '</loc></url>' + articles.map(a => `<url><loc>${escape(blogArticleUrl(base, a.id))}</loc><lastmod>${iso(a.updatedAt)}</lastmod></url>`).join('') + '</urlset>';
}
