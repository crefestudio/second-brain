import {Extension, Mark, Node, mergeAttributes} from '@tiptap/core';
import {imageUrl, normalizeStyle} from '../../../../../functions/src/community-document';

export const HtmlImage = Node.create({
    name: 'image', group: 'inline', inline: true, atom: true, draggable: true,
    addAttributes: () => ({
        src: {default: null, parseHTML: element => imageUrl(element.getAttribute('src'))},
        alt: {default: '', parseHTML: element => (element.getAttribute('alt') || '').slice(0, 1000)},
        title: {default: null, parseHTML: element => element.getAttribute('title')?.slice(0, 1000) || null},
        width: {default: null, parseHTML: element => imageSize(element.getAttribute('width'))},
        height: {default: null, parseHTML: element => imageSize(element.getAttribute('height'))},
    }),
    parseHTML: () => [{tag: 'img[src]', getAttrs: element => imageUrl(element.getAttribute('src')) ? null : false}],
    renderHTML: ({HTMLAttributes}) => ['img', mergeAttributes(HTMLAttributes, {loading: 'lazy', referrerpolicy: 'no-referrer'})],
});
function imageSize(value: string | null): number | null {
    const size = Number(value);
    return Number.isInteger(size) && size > 0 && size <= 10000 ? size : null;
}

const hasBlocks = (element: HTMLElement) => Array.from(element.children).some(child => /^(DIV|P|H[1-6]|UL|OL|BLOCKQUOTE|PRE|HR)$/.test(child.tagName));

export const HtmlContainer = Node.create({
    name: 'htmlContainer', group: 'block', content: 'block+', defining: true,
    parseHTML: () => [{tag: 'div', getAttrs: element => hasBlocks(element) ? null : false}],
    renderHTML: ({HTMLAttributes}) => ['div', mergeAttributes(HTMLAttributes), 0],
});
export const HtmlParagraph = Node.create({
    name: 'htmlParagraph', group: 'block', content: 'inline*', defining: true,
    parseHTML: () => [{tag: 'div', getAttrs: element => hasBlocks(element) ? false : null}],
    renderHTML: ({HTMLAttributes}) => ['div', mergeAttributes(HTMLAttributes), 0],
});
export const StyledSpan = Mark.create({
    name: 'styledSpan',
    parseHTML: () => [{tag: 'span[style]'}],
    renderHTML: ({HTMLAttributes}) => ['span', mergeAttributes(HTMLAttributes), 0],
});
export const HtmlStyles = Extension.create({
    name: 'htmlStyles',
    addGlobalAttributes: () => [{
        types: ['image', 'htmlContainer', 'htmlParagraph', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'horizontalRule', 'bold', 'italic', 'strike', 'underline', 'code', 'link', 'styledSpan'],
        attributes: {style: {
            default: null,
            parseHTML: element => normalizeStyle(element.getAttribute('style')) || null,
            renderHTML: attributes => {
                const style = normalizeStyle(attributes['style']);
                return style ? {style} : {};
            },
        }},
    }],
});

// Parse inertly, then hand only supported markup to the editor schema.
export function prepareHtml(source: string): string {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,svg,math,template,link,meta,base').forEach(element => element.remove());
    doc.body.querySelectorAll('*').forEach(element => {
        for (const attribute of Array.from(element.attributes)) {
            if (!['style', 'href', 'start', 'src', 'alt', 'title', 'width', 'height'].includes(attribute.name)) element.removeAttribute(attribute.name);
        }
        if (element.tagName === 'IMG') {
            const src = imageUrl(element.getAttribute('src'));
            if (!src) { element.remove(); return; }
            element.setAttribute('src', src);
        } else element.removeAttribute('src');
        const style = normalizeStyle(element.getAttribute('style'));
        if (style) element.setAttribute('style', style);
        else element.removeAttribute('style');
        const href = element.getAttribute('href');
        if (href && (!/^(https?:\/\/|mailto:)[^\s]+$/i.test(href) || /[\u0000-\u001f\u007f]/.test(href))) element.removeAttribute('href');
    });
    return doc.body.innerHTML;
}
