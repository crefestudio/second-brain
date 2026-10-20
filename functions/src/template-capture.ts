// AI classification stays unchanged; this conversion only controls storage.
export function fallbackCaptureTitle(title: string, sourceDb: string): string {
    const labels: Record<string, string> = { task: '할일', memo: '메모', reference: '자료', contact: '연락처', project: '프로젝트', book: '도서' };
    const label = labels[sourceDb];
    if (!label || title.startsWith(`[ ${label} ]`) || title.startsWith(`[${label}]`)) return title;
    return `[ ${label} ] ${title}`;
}

export function toNoteCapture(result: any, entity: any, userMessage: string): any {
    const contact = { ...entity, ...result.entity };
    const labels: Record<string, string> = { name: '이름', company: '회사', department: '부서', position: '직책', phone: '전화', mobile: '휴대폰', fax: '팩스', email: '이메일', address: '주소', website: '웹사이트', ocrText: '명함 원문' };
    const parts = [userMessage, typeof result.content === 'string' ? result.content : JSON.stringify(result.content || ''),
        result.db === 'contact' ? Object.keys(labels).filter(key => contact[key]).map(key => `${labels[key]}: ${contact[key]}`).join('\n') : ''];
    return { ...result, db: 'note', sourceDb: result.sourceDb || result.db, noteCapture: true,
        originalTitle: result.originalTitle || result.title || contact.name || '새 노트',
        title: fallbackCaptureTitle(result.title || contact.name || '새 노트', result.db),
        content: [...new Set(parts.filter(Boolean))].join('\n\n'),
        project: undefined, folder: undefined, importance: undefined };
}
