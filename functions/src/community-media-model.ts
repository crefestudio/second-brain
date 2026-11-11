export interface CommunityMedia { type: 'image' | 'video'; src: string }

// Produce embed URLs only from recognized providers, never from arbitrary HTML.
export function communityVideoUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        const host = url.hostname;
        let id: string | null = null;
        if (host === 'youtu.be') id = url.pathname.slice(1);
        if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
            id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:embed|shorts|live)\/([^/]+)$/.exec(url.pathname)?.[1] || null;
        }
        if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
        if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
            const video = /^\/(?:video\/)?(\d+)$/.exec(url.pathname);
            if (video) return `https://player.vimeo.com/video/${video[1]}`;
        }
        return null;
    } catch { return null; }
}
