import { normalizeYoutubeHandle } from './lifeup-gift';

export const LIFEUP_GIFT_VIDEO_ID = '77Upxaer2nA';

export class GiftCommentError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
}

type YoutubeRequest = (url: string, init: { signal: AbortSignal }) => Promise<{
    ok: boolean; json(): Promise<any>;
}>;

// Resolve the handle to a channel ID: display names are neither unique nor stable.
export async function verifyGiftComment(handle: string, apiKey: string | undefined, request: YoutubeRequest = fetch): Promise<{
    videoId: string; channelId: string; commentId: string;
}> {
    const unavailable = () => new GiftCommentError(503, '유튜브 댓글을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    if (!apiKey) throw unavailable();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const read = async (resource: string, parameters: Record<string, string>) => {
        const params = new URLSearchParams({ ...parameters, key: apiKey });
        const response = await request(`https://www.googleapis.com/youtube/v3/${resource}?${params}`, { signal: controller.signal });
        if (!response.ok) throw unavailable();
        const data = await response.json();
        if (data?.items === undefined && data?.pageInfo?.totalResults === 0) data.items = [];
        if (!Array.isArray(data?.items)) throw unavailable();
        return data;
    };
    try {
        const channels = await read('channels', { part: 'id', forHandle: normalizeYoutubeHandle(handle) });
        const channelId = channels.items[0]?.id;
        if (typeof channelId !== 'string' || !channelId) {
            throw new GiftCommentError(400, '유튜브 아이디를 찾을 수 없습니다. 댓글에 표시된 @아이디를 다시 확인해 주세요.');
        }
        let pageToken = '';
        const seen = new Set<string>();
        for (let page = 0; page < 100; page++) {
            const comments = await read('commentThreads', {
                part: 'snippet', videoId: LIFEUP_GIFT_VIDEO_ID, maxResults: '100',
                textFormat: 'plainText', order: 'time',
                ...(pageToken ? { pageToken } : {})
            });
            for (const item of comments.items) {
                const comment = item?.snippet?.topLevelComment;
                const snippet = comment?.snippet;
                if (snippet?.authorChannelId?.value === channelId
                    && typeof comment.id === 'string' && comment.id) {
                    return { videoId: LIFEUP_GIFT_VIDEO_ID, channelId, commentId: comment.id };
                }
            }
            if (!comments.nextPageToken) {
                throw new GiftCommentError(400, '해당 아이디의 댓글을 찾지 못했습니다. 답글은 확인이 안됩니다. 새 댓글로 남겨주세요. 방금 작성했다면 잠시 후 다시 시도해 주세요.');
            }
            pageToken = comments.nextPageToken;
            if (seen.has(pageToken)) throw unavailable();
            seen.add(pageToken);
        }
        // An incomplete scan must not be reported as an absent comment.
        throw unavailable();
    } catch (error) {
        if (error instanceof GiftCommentError) throw error;
        throw unavailable();
    } finally {
        clearTimeout(timer);
    }
}
