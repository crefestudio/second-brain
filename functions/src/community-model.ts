import { CommunityMedia } from './community-media-model';
import {ClubDocument} from './community-document';
// Shared room catalogue. Membership is independent of product purchases and tiers.
export const COMMUNITY_ROOMS = [
    { id: 'about', group: '시작하기', name: '클럽 소개', icon: 'compass', kind: 'feed', adminOnly: true, description: '함께 배우고, 나누고, 성장하는 노셔너블 클럽입니다.' },
    { id: 'announcements', group: '시작하기', name: '공지사항', icon: 'megaphone', kind: 'feed', adminOnly: true, description: '클럽의 새로운 소식과 꼭 알아야 할 안내' },
    { id: 'events', group: '시작하기', name: '이벤트', icon: 'calendar', kind: 'feed', adminOnly: true, description: '함께 참여하는 모임과 이벤트' },
    { id: 'requests', hidden: true, group: '시작하기', name: '요청하기', icon: 'chat', kind: 'request', adminOnly: false, description: '클럽에 필요한 주제가 있으면 말씀해주세요. 각종 개선 의견 및 요청을 편하게 말씀해주세요.' },
    { id: 'hello', group: '함께 나누기', name: '인사하기', icon: 'hand', kind: 'feed', adminOnly: false, description: '반가워요! 나의 관심사와 이야기를 들려주세요.' },
    { id: 'questions', group: '함께 나누기', name: '묻고 답하기', icon: 'question', kind: 'question', adminOnly: false, description: '궁금한 점을 묻고 서로의 경험으로 답해요.' },
    { id: 'member-news', group: '함께 나누기', name: '알림 마당', icon: 'megaphone', kind: 'feed', adminOnly: false, description: '멤버에게 알리고 싶은 이야기를 자유주제로 포스팅하는 곳입니다. 홍보글도 좋지만 반복되는 포스팅, 스팸성·과도한 포스팅 등은 제한됩니다.' },
    { id: 'notion', group: '알아보기', name: '노션', icon: 'grid', kind: 'both', adminOnly: false, description: '노션으로 만드는 나만의 시스템' },
    { id: 'gtd', group: '알아보기', name: 'GTD', icon: 'check', kind: 'both', adminOnly: false, description: '할 일을 정리하고 중요한 일에 집중하는 방법' },
    { id: 'secondbrain', group: '알아보기', name: '세컨드브레인', icon: 'spark', kind: 'both', adminOnly: false, description: '지식을 연결하고 아이디어를 키우는 공간' },
    { id: 'ai-automation', group: '알아보기', name: 'AI / 자동화', icon: 'spark', kind: 'both', adminOnly: false, description: 'AI 활용과 자동화 경험, 궁금한 점을 함께 나눠요.' },
    { id: 'kakao', group: '주제방', name: '카카오톡 비서', icon: 'chat', kind: 'both', adminOnly: false, description: '카카오톡 비서의 활용 경험과 개선 의견을 나눠요.' },
    { id: 'routines', group: '주제방', name: '루틴 관리', icon: 'repeat', kind: 'both', adminOnly: false, description: '작은 실천을 꾸준한 변화로 만드는 이야기' },
    { id: 'development', group: '주제방', name: '클럽', icon: 'code', kind: 'both', adminOnly: false, description: '클럽 개선 의견과 오류를 함께 나눠요.' },
    { id: 'widgets', group: '주제방', name: '위젯', icon: 'grid', kind: 'both', adminOnly: false, description: '위젯 활용 경험과 개선 의견을 나눠요.' },
    { id: 'budget', group: '주제방', name: '가계부', icon: 'book', kind: 'both', adminOnly: false, description: '가계부 활용 경험과 개선 의견을 나눠요.' },
    { id: 'lifeup', group: '서비스', name: '라이프업', icon: 'spark', kind: 'both', adminOnly: false, description: '라이프업 활용 경험과 궁금한 점, 개선 의견을 함께 나눠요.' },
    { id: 'bizup', group: '서비스', name: '비즈업', icon: 'grid', kind: 'both', adminOnly: false, description: '비즈업 활용 경험과 궁금한 점, 개선 의견을 함께 나눠요.' }
] as const;
// Toggle hidden to restore a room without deleting its posts.
export function isCommunityRoomVisible(id: unknown): boolean {
    const room = COMMUNITY_ROOMS.find(item => item.id === id);
    return !!room && !('hidden' in room && room.hidden);
}
export type CommunityRoom = typeof COMMUNITY_ROOMS[number];
export function supportsCommunityRequests(id: unknown): boolean {
    const room = COMMUNITY_ROOMS.find(item => item.id === id);
    return !!room && isCommunityRoomVisible(id) && (room.group === '주제방' || room.id === 'lifeup' || room.id === 'bizup');
}
export type CommunityKind = 'feed' | 'question' | 'request';
export interface CommunityMember { id: string; name: string; bio: string; joinedAt: number; isAdmin?: boolean; avatar?: string }
export interface CommunityPost {
    bodyDocument?: ClubDocument | null;
    pinExpiresAt?: number; pinnedAt?: number;
    id: string; isPrivate?: boolean; roomId: string; kind: CommunityKind; title: string; body: string; media?: CommunityMedia[];
    authorId: string; authorName: string; authorIsAdmin?: boolean; authorAvatar?: string; createdAt: number; updatedAt: number; version: number;
    sharedInstagramUrl?: string; newsletterSentCount?: number; newsletterRequestedAt?: number;
    websitePublishedAt?: number; websitePublishedVersion?: number;
    sharing?: { newsletter: boolean; kakao: boolean; instagram?: boolean };
    likes: number; comments: number; acceptedCommentId: string | null; liked?: boolean;
}
export interface CommunityComment {
    id: string; body: string; authorId: string; authorName: string; authorIsAdmin?: boolean; authorAvatar?: string;
    createdAt: number; updatedAt: number; version: number; deleted: boolean;
}
