import { CommunityMedia, communityVideoUrl } from './community-media-model';

export async function normalizeCommunityMedia(value: unknown): Promise<CommunityMedia[]> {
    const invalid = (message = '첨부 데이터를 확인해주세요. 사진과 동영상은 각각 최대 3개까지 추가할 수 있습니다.') => Object.assign(new Error(message), {status: 400});
    if (!Array.isArray(value) || value.length > 6) throw invalid();
    const result: CommunityMedia[] = [];
    for (const item of value) {
        if (!item || typeof item.src !== 'string') throw invalid();
        if (item.type === 'video') {
            const src = communityVideoUrl(item.src);
            if (!src) throw invalid('YouTube 또는 Vimeo 동영상의 HTTPS 링크를 확인해주세요.');
            if (result.filter(m => m.type === 'video').length >= 3) throw invalid('동영상은 최대 3개까지 추가할 수 있습니다.');
            result.push({type: 'video', src});
        } else if (item.type === 'image') {
            if (result.filter(m => m.type === 'image').length >= 3) throw invalid('사진은 최대 3장까지 추가할 수 있습니다.');
            if (item.src.length > 180000) throw invalid('사진 용량이 너무 큽니다. 크기를 줄인 후 다시 선택해주세요.');
            const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.src);
            if (!match) throw invalid();
            try {
                const bytes = Buffer.from(match[1], 'base64');
                if (bytes.toString('base64') !== match[1]) throw invalid();
                // Legacy TS resolution uses ESM types; the deployed runtime loads sharp's CJS export.
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const sharp: typeof import('sharp').default = require('sharp');
                const decoder = sharp(bytes, {limitInputPixels: 25000000, failOn: 'warning'});
                const meta = await decoder.metadata();
                if (meta.format !== 'jpeg' || (meta.pages || 1) !== 1 || (meta.width || 0) > 1600 || (meta.height || 0) > 1600) throw invalid();
                // Browsers can attach a color profile to canvas JPEGs. Accept valid
                // images and remove metadata instead of rejecting those photos.
                if (meta.exif || meta.icc || meta.xmp || meta.iptc) {
                    let normalized = '';
                    for (const quality of [85, 75, 65, 55, 45, 35, 25]) {
                        const output = await decoder.clone().rotate().jpeg({quality}).toBuffer();
                        normalized = 'data:image/jpeg;base64,' + output.toString('base64');
                        if (normalized.length <= 180000) break;
                    }
                    if (normalized.length > 180000) throw invalid();
                    result.push({type: 'image', src: normalized});
                    continue;
                }
                await decoder.stats(); // Decode the full image before accepting it.
                result.push({type: 'image', src: item.src});
            } catch { throw invalid('사진을 처리하지 못했습니다. 사진을 삭제한 뒤 다시 선택해주세요.'); }
        } else throw invalid();
    }
    return result;
}
