export const KAKAO_CONNECTION_REQUIRED = '연결된 템플릿이 없어 요청을 처리하지 못했습니다.\n라이프봇 연결 설정에서 템플릿과 카카오톡을 연결해주세요.';

export function kakaoConnectionErrorMessage(error: unknown, isPhoto = false): string | undefined {
    const value = error as { code?: string; message?: string } | null;
    if (value?.message === 'NOTION_CONNECTION_REQUIRED') return KAKAO_CONNECTION_REQUIRED;
    const message = value?.message || '';
    const permissionError = ['unauthorized', 'restricted_resource', 'object_not_found'].includes(value?.code || '') ||
        /Notion API 호출 실패: (401|403|404)\b/.test(message);
    if (permissionError) return `노션 API 연결 권한이 없어 ${isPhoto ? '사진을 저장' : '요청을 처리'}하지 못했습니다.\n라이프봇은 한 번에 하나의 템플릿만 연결하여 사용할 수 있습니다.\n계속 이용하시려면 기존 템플릿 연결을 해제한 뒤, 사용할 템플릿과 카카오톡을 다시 연결해주세요.`;
    // Search can also fail because a database was renamed or deleted.
    if (/Database를 찾을 수 없습니다/.test(message)) return '연결된 템플릿의 노션 데이터베이스를 찾을 수 없어 요청을 처리하지 못했습니다.\n노션의 페이지 연결 권한과 데이터베이스 이름을 확인해주세요.\n계속 이용하시려면 기존 템플릿 연결을 해제한 뒤, 사용할 템플릿과 카카오톡을 다시 연결해주세요.';
    return undefined;
}
