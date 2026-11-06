const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { receiveKakaoAttachment, attachmentName, buildFileBlocks, kakaoAttachmentName } = require('../lib/kakao-attachment');

function storage(fail = false) {
    const state = { bytes: 0, deleted: false, maxChunk: 0 };
    return { state, name: 'test-bucket', file(name) {
        state.name = name;
        return { createWriteStream(options) {
            state.options = options;
            return new Writable({ write(chunk, _, cb) {
                state.bytes += chunk.length; state.maxChunk = Math.max(state.maxChunk, chunk.length);
                setImmediate(() => cb(fail ? new Error('upload failed') : null));
            } });
        }, async delete() { state.deleted = true; } };
    } };
}
function response(bytes, type, length = bytes.length) {
    let offset = 0;
    return new Response(new ReadableStream({ pull(controller) {
        if (offset >= length) return controller.close();
        const count = Math.min(65536, length - offset);
        const chunk = new Uint8Array(count);
        if (!offset) chunk.set(bytes.subarray(0, count));
        offset += count; controller.enqueue(chunk);
    } }), { headers: { 'content-type': type, 'content-disposition': "attachment; filename*=UTF-8''%ED%85%8C%EC%8A%A4%ED%8A%B8.pdf" } });
}
test('47 MB PDF streams to storage without whole-body or base64 conversion and becomes a file block', async () => {
    const bucket = storage();
    const res = response(Buffer.from('%PDF-1.7'), 'etc/pdf', 47071751);
    res.arrayBuffer = () => { throw new Error('must stream'); };
    const result = await receiveKakaoAttachment('https://talk.kakaocdn.net/file', 'test-user', bucket, async () => res, Date.parse('2027-10-31T22:22:00Z'));
    assert.equal(result.type, 'file');
    assert.equal(result.contentType, 'application/pdf');
    assert.equal(result.originalName, '202711010722_Kakao.pdf');
    assert.equal(bucket.state.options.metadata.contentDisposition, "attachment; filename*=UTF-8''202711010722_Kakao.pdf");
    assert.equal(buildFileBlocks(result)[0].file.name, result.originalName);
    assert.equal(result.size, 47071751);
    assert.equal(bucket.state.bytes, result.size);
    assert.ok(bucket.state.maxChunk <= 65536);
    assert.match(bucket.state.name, /^attachments\/test-user\//);
    assert.equal(buildFileBlocks(result)[0].file.external.url, result.fileUrl);
    assert.equal(buildFileBlocks(result)[0].type, 'file');
});
test('PDF signature overrides incorrect image content type', async () => {
    const result = await receiveKakaoAttachment('https://talk.kakaocdn.net/photo.jpg', 'u', storage(), async () => response(Buffer.from('%PDF-1.7'), 'image/jpeg'));
    assert.equal(result.type, 'file');
});
test('JPEG bytes retain the image analysis path without a second fetch', async () => {
    const bytes = Buffer.from([255, 216, 255, 224, 0, 0]);
    const bucket = storage(); let calls = 0;
    const result = await receiveKakaoAttachment('https://talk.kakaocdn.net/photo', 'u', bucket, async () => { calls++; return response(bytes, 'application/octet-stream'); });
    assert.equal(result.type, 'image'); assert.deepEqual(result.buffer, bytes);
    assert.equal(calls, 1); assert.equal(bucket.state.name, undefined);
});
test('unsupported and unknown files stay out of image analysis', async () => {
    for (const type of ['application/zip', 'image/svg+xml', '']) {
        const result = await receiveKakaoAttachment('https://talk.kakaocdn.net/file', 'u', storage(), async () => response(Buffer.from('not an image'), type));
        assert.equal(result.type, 'file');
    }
});
test('failed storage writes clean up and do not return an attachment', async () => {
    const bucket = storage(true);
    await assert.rejects(receiveKakaoAttachment('https://talk.kakaocdn.net/file', 'u', bucket, async () => response(Buffer.from('%PDF-1.7'), 'etc/pdf')), /upload failed/);
    assert.equal(bucket.state.deleted, true);
});
test('oversized images and failed HTTP downloads fail before analysis', async () => {
    await assert.rejects(receiveKakaoAttachment('https://talk.kakaocdn.net/file', 'u', storage(), async () => response(Buffer.from([255,216,255]), 'image/jpeg', 21*1024*1024)), /TOO_LARGE/);
    await assert.rejects(receiveKakaoAttachment('https://talk.kakaocdn.net/file', 'u', storage(), async () => new Response('', { status: 404 })), /DOWNLOAD_FAILED_404/);
});
test('filenames preserve extensions, decode Korean and strip paths', () => {
    assert.equal(attachmentName('https://example.test/a.zip', '', 'application/zip'), 'a.zip');
    assert.equal(attachmentName('https://example.test/a', 'attachment; filename="../report.pdf"', 'application/pdf'), 'report.pdf');
});

test('generated names use receipt time in Korea with no prefix and retain file extensions', () => {
    const receivedAt = Date.parse('2027-10-31T22:22:59Z');
    assert.equal(kakaoAttachmentName('image/jpeg', 'wrong.pdf', receivedAt), '202711010722_Kakao.jpg');
    assert.equal(kakaoAttachmentName('application/octet-stream', 'f_123.XLSX', receivedAt), '202711010722_Kakao.xlsx');
    assert.equal(kakaoAttachmentName('application/octet-stream', '', receivedAt), '202711010722_Kakao.bin');
    assert.equal(kakaoAttachmentName('application/pdf', '', Date.parse('2027-12-31T15:00:00Z')), '202801010000_Kakao.pdf');
});
