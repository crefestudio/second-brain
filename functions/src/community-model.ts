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
    { id: 'notion', group: '함께 배우기', name: '노션', icon: 'grid', kind: 'both', adminOnly: false, description: '노션의 기본 기능부터 실전 활용 팁까지 함께 배우고 나눕니다.' },
    { id: 'gtd', group: '함께 배우기', name: 'GTD', icon: 'check', kind: 'both', adminOnly: false, description: '할 일을 정리하고 실행에 집중하는 GTD 방법을 함께 배우고 나눕니다.' },
    { id: 'secondbrain', group: '함께 배우기', name: '세컨드브레인', icon: 'spark', kind: 'both', adminOnly: false, description: '메모와 자료를 체계적으로 모으고, 지식과 결과물로 연결하는 방법을 나눕니다.' },
    { id: 'ai-automation', group: '함께 배우기', name: 'AI / 자동화', icon: 'spark', kind: 'both', adminOnly: false, description: 'AI와 자동화로 일상의 번거로움을 줄이는 방법과 활용 사례를 나눕니다.' },
    { id: 'lifeup', group: '서비스', name: '라이프업', icon: 'spark', kind: 'both', adminOnly: false, description: '삶을 체계적으로 관리하는 라이프업의 서비스와 소식을 안내합니다.' },
    { id: 'bizup', group: '서비스', name: '비즈업', icon: 'grid', kind: 'both', adminOnly: false, description: '비즈니스의 업무 관리와 협업을 돕는 비즈업의 서비스와 소식을 안내합니다.' },
    { id: 'lifeup-gtd', group: '라이프업 템플릿', name: 'GTD 할 일 관리', icon: 'check', kind: 'both', adminOnly: false, description: 'GTD 할 일 관리 템플릿의 사용법·업데이트를 안내하고, 질문과 의견을 받습니다.' },
    { id: 'lifeup-secondbrain-os', group: '라이프업 템플릿', name: '세컨드브레인 OS', icon: 'spark', kind: 'both', adminOnly: false, description: '템플릿 사용법과 업데이트를 안내하고, 질문·개선 의견·오류 신고를 받습니다.' },
    { id: 'lifeup-notes-scrapbook', group: '라이프업 템플릿', name: '메모장 & 스크랩북', icon: 'book', kind: 'both', adminOnly: false, description: '메모와 자료 수집을 위한 템플릿의 사용법·업데이트를 안내하고, 질문과 의견을 받습니다.' },
    { id: 'kakao', group: '작업실', name: '카카오톡 비서', icon: 'chat', kind: 'both', adminOnly: false, description: '카카오톡으로 일상을 편리하게 관리하는 비서 기능을 함께 만들고 개선합니다.' },
    { id: 'routines', group: '작업실', name: '루틴 관리', icon: 'repeat', kind: 'both', adminOnly: false, description: '꾸준한 실천을 돕는 루틴 관리 기능을 함께 만들고 개선합니다.' },
    { id: 'development', group: '작업실', name: '노셔너블 클럽', icon: 'code', kind: 'both', adminOnly: false, description: '더 편리하고 유익한 클럽을 만들기 위해 의견을 나누고 개선합니다.' },
    { id: 'widgets', group: '작업실', name: '위젯', icon: 'grid', kind: 'both', adminOnly: false, description: '필요한 정보를 한눈에 확인할 수 있는 다양한 위젯을 함께 만들고 개선합니다.' },
    { id: 'budget', group: '작업실', name: '가계부', icon: 'book', kind: 'both', adminOnly: false, description: '수입과 지출을 쉽게 기록하고 관리할 수 있는 가계부를 함께 만들고 개선합니다.' }
] as const;
// Toggle hidden to restore a room without deleting its posts.
export function isCommunityRoomVisible(id: unknown): boolean {
    const room = COMMUNITY_ROOMS.find(item => item.id === id);
    return !!room && !('hidden' in room && room.hidden);
}
export type CommunityRoom = typeof COMMUNITY_ROOMS[number];
export function supportsCommunityRequests(id: unknown): boolean {
    const room = COMMUNITY_ROOMS.find(item => item.id === id);
    return !!room && isCommunityRoomVisible(id) && (room.group === '작업실' || room.group === '라이프업 템플릿' || room.id === 'lifeup' || room.id === 'bizup');
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
