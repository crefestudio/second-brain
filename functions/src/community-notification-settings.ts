export const NOTIFICATION_CATEGORIES = [
    {id: 'activity', label: '내 활동 알림', description: '내 글의 댓글·답변, 답변 채택, 운영 안내'},
    {id: 'adminPosts', label: '관리자 새 글 알림', description: '공지·이벤트를 제외한 관리자 새 글'},
    {id: 'notices', label: '중요 기본 공지 안내', description: '공지사항 방에 올라오는 관리자 안내'},
    {id: 'events', label: '이벤트 알림', description: '이벤트 방의 새로운 소식'}
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number]['id'];
export type NotificationPreferences = Record<NotificationCategory, {email: boolean; talk: boolean}>;
export function notificationPreferences(settings?: {email?: boolean; talk?: boolean; categories?: Partial<NotificationPreferences>}): NotificationPreferences {
    return Object.fromEntries(NOTIFICATION_CATEGORIES.map(({id}) => [id, {
        email: settings?.categories?.[id]?.email ?? (settings?.email !== false),
        talk: settings?.categories?.[id]?.talk ?? (settings?.talk !== false)
    }])) as NotificationPreferences;
}
export function notificationSettingsRecord(categories: NotificationPreferences, confirmedAt: number) {
    return {categories, email: Object.values(categories).some(c => c.email), talk: Object.values(categories).some(c => c.talk), confirmedAt};
}
export function validNotificationPreferences(value: unknown): value is NotificationPreferences {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const input = value as Record<string, unknown>;
    return Object.keys(input).length === NOTIFICATION_CATEGORIES.length && NOTIFICATION_CATEGORIES.every(({id}) => {
        const channels = input[id] as Record<string, unknown> | undefined;
        return !!channels && !Array.isArray(channels) && typeof channels['email'] === 'boolean' && typeof channels['talk'] === 'boolean' && Object.keys(channels).length === 2;
    });
}
