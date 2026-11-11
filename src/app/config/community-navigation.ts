export const isCommunityHost = () => ['club.notionable.net', 'community.notionable.net'].includes(window.location.hostname);
export const communityHomePath = () => isCommunityHost() ? '/' : '/club';

export function isCommunityReturnPath(path: string) {
    return /^\/(?:club|community)(?:[?#]|$)/.test(path) || (isCommunityHost() && /^\/(?:[?#]|$)/.test(path));
}
