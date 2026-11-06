import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
// The installed ESLint resolver does not understand Firebase package subpath exports.
// eslint-disable-next-line import/no-unresolved
import { getStorage } from 'firebase-admin/storage';
import { FileEntity } from './services/assistant-entity';
type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export function attachmentType(head: Buffer, header: string): string {
    if (head.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
    if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (head[0] === 255 && head[1] === 216 && head[2] === 255) return 'image/jpeg';
    if (/^GIF8[79]a/.test(head.subarray(0, 6).toString())) return 'image/gif';
    if (head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
    const type = header.split(';')[0].trim().toLowerCase();
    // Unverified image formats must never enter the image/base64 analysis path.
    return type === 'etc/pdf' ? 'application/pdf' : type.startsWith('image/') ? 'application/octet-stream' : type || 'application/octet-stream';
}

export function attachmentName(url: string, disposition: string, contentType: string): string {
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    let name = encoded || /filename="([^"]+)"/i.exec(disposition)?.[1] || /filename=([^;]+)/i.exec(disposition)?.[1] || new URL(url).pathname.split('/').pop() || 'attachment';
    try { name = decodeURIComponent(name); } catch { /* Keep malformed encoded names literal. */ }
    name = Array.from(name.split(/[\\/]/).pop() || '').filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').trim().slice(0, 180) || 'attachment';
    if (contentType === 'application/pdf' && !/\.pdf$/i.test(name)) name += '.pdf';
    return name;
}

export function buildFileBlocks(entity: FileEntity) {
    return [{ object: 'block' as const, type: 'file' as const,
        file: { type: 'external' as const, external: { url: entity.fileUrl }, name: entity.originalName } }];
}

export function kakaoAttachmentName(contentType: string, sourceName = '', receivedAt = Date.now()): string {
    const extensions: Record<string, string> = {
        'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'application/zip': 'zip', 'text/plain': 'txt', 'text/csv': 'csv', 'application/json': 'json',
        'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    const extension = extensions[contentType.split(';')[0].trim().toLowerCase()] || /\.([a-z0-9]{1,10})$/i.exec(sourceName)?.[1].toLowerCase() || 'bin';
    // Fixed UTC+9 is independent of the worker's timezone and processing delay.
    const date = new Date(receivedAt + 9 * 60 * 60 * 1000);
    const stamp = date.toISOString().slice(0, 16).replace(/[-T:]/g, '');
    return `${stamp}_Kakao.${extension}`;
}

// Only recognized images are buffered. All other files are streamed with backpressure.
export async function receiveKakaoAttachment(url: string, uid: string, bucket: Bucket, fetcher: typeof fetch = fetch, receivedAt = Date.now()) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`ATTACHMENT_DOWNLOAD_FAILED_${response.status}`);
    const reader = response.body.getReader();
    let storageFile: ReturnType<Bucket['file']> | undefined;
    try {
        const prefix: Buffer[] = [];
        let prefixSize = 0;
        while (prefixSize < 16) {
            const part = await reader.read();
            if (part.done) break;
            const chunk = Buffer.from(part.value);
            prefix.push(chunk); prefixSize += chunk.length;
        }
        if (!prefixSize) throw new Error('ATTACHMENT_EMPTY');
        const contentType = attachmentType(Buffer.concat(prefix, prefixSize).subarray(0, 16), response.headers.get('content-type') || '');
        let size = 0;
        const isImage = contentType.startsWith('image/');
        const limit = isImage ? 20 * 1024 * 1024 : 200 * 1024 * 1024;
        const chunks = async function* () {
            for (const chunk of prefix) { size += chunk.length; if (size > limit) throw new Error('ATTACHMENT_TOO_LARGE'); yield chunk; }
            while (true) {
                const part = await reader.read();
                if (part.done) break;
                size += part.value.byteLength;
                if (size > limit) throw new Error('ATTACHMENT_TOO_LARGE');
                yield Buffer.from(part.value);
            }
        };
        if (Number(response.headers.get('content-length')) > limit) throw new Error('ATTACHMENT_TOO_LARGE');
        if (isImage) {
            const buffers: Buffer[] = [];
            for await (const chunk of chunks()) buffers.push(chunk);
            return { type: 'image' as const, buffer: Buffer.concat(buffers, size), contentType, originalName: kakaoAttachmentName(contentType, '', receivedAt) };
        }
        const originalName = kakaoAttachmentName(contentType, attachmentName(url, response.headers.get('content-disposition') || '', contentType), receivedAt);
        const fileName = `attachments/${uid}/${randomUUID()}/${originalName}`;
        const token = randomUUID();
        storageFile = bucket.file(fileName);
        await pipeline(Readable.from(chunks()), storageFile.createWriteStream({ resumable: false,
            metadata: { contentType, cacheControl: 'private, max-age=0, no-cache',
                contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
                metadata: { firebaseStorageDownloadTokens: token } } }));
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
        return { type: 'file' as const, fileUrl, fileName, originalName, contentType, size };
    } catch (error) {
        if (storageFile) await storageFile.delete({ ignoreNotFound: true }).catch(() => { /* Preserve the transfer error. */ });
        throw error;
    } finally {
        await reader.cancel().catch(() => { /* The body may already have failed. */ });
        reader.releaseLock();
    }
}
