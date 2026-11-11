// Small, normalized thumbnails stay behind the existing member-only API.
// Never store originals, arbitrary URLs, SVG, or client-supplied metadata.
export async function normalizeCommunityAvatar(value: unknown): Promise<string> {
    if (value === '') return '';
    const invalid = () => Object.assign(new Error('프로필 사진을 확인해주세요. JPG·PNG·WebP 이미지를 다시 선택해주세요.'), {status: 400});
    if (typeof value !== 'string' || value.length > 180000) throw invalid();
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw invalid();
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 128 * 1024 || bytes.toString('base64') !== match[2]) throw invalid();
    try {
        // Legacy TS module resolution reads sharp's ESM types; Node uses its CJS export.
        // Load the native decoder only for photo updates, not every community request.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sharp: typeof import('sharp').default = require('sharp');
        const image = sharp(bytes, {limitInputPixels: 25000000, failOn: 'warning'});
        const metadata = await image.metadata();
        if (metadata.format !== match[1] || (metadata.pages || 1) !== 1) throw invalid();
        const thumbnail = await image.rotate().resize(192, 192, {fit: 'cover', position: 'centre'})
            .flatten({background: '#ffffff'}).jpeg({quality: 80}).toBuffer();
        if (thumbnail.length > 48 * 1024) throw invalid();
        return 'data:image/jpeg;base64,' + thumbnail.toString('base64');
    } catch { throw invalid(); }
}
