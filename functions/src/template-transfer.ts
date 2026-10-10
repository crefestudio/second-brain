export interface TransferDatabase { id: string; title: string }
export interface TransferPlan {
    template: string;
    pairs: Record<string, { source: string; target: string }>;
    skipped: string[];
}

export function transferPlanKey(plan: TransferPlan): string {
    return JSON.stringify([plan.template, Object.keys(plan.pairs).sort().map(name => [name, plan.pairs[name].source, plan.pairs[name].target]), [...plan.skipped].sort()]);
}

// Match complete identities: note / 15 must never match note / 15 / ScrapBook.
export function databaseIdentity(title: string): string[] {
    return title.normalize('NFKC').split(/[/#]/).map(part => part.trim().replace(/\s+/g, ' ').toLowerCase());
}

export function detectTransfer(databases: TransferDatabase[], names: string[]): TransferPlan {
    const unique = [...new Map(databases.map(item => [item.id.replace(/-/g, ''), item])).values()];
    const parsed = unique.map(item => ({ ...item, parts: databaseIdentity(item.title) }));
    const sources = parsed.filter(item => item.parts.length === 3 && item.parts[1] === '15' && !!item.parts[2]);
    const templates = [...new Set(sources.map(item => item.parts[2]))];
    if (!templates.length) throw new Error('이전할 개별 1.5 템플릿을 찾지 못했습니다. 접근 권한과 DB 이름을 확인해주세요.');
    if (templates.length > 1) throw new Error(`여러 개별 템플릿이 연결되어 있습니다: ${templates.join(', ')}. 이전할 템플릿 하나만 연결해주세요.`);
    const pairs: TransferPlan['pairs'] = {};
    const skipped: string[] = [];
    for (const name of names) {
        const source = sources.filter(item => item.parts[0] === name.toLowerCase());
        if (!source.length) { skipped.push(name); continue; }
        if (source.length > 1) throw new Error(`${name} 원본 DB가 여러 개 존재합니다. 중복 연결을 해제해주세요.`);
        const target = parsed.filter(item => item.parts.length === 2 && item.parts[0] === name.toLowerCase() && item.parts[1] === '15');
        if (target.length !== 1) throw new Error(`${name} 통합 1.5 DB${target.length ? '가 여러 개 존재합니다.' : '를 찾을 수 없습니다.'}`);
        if (source[0].id === target[0].id) throw new Error('원본과 대상 DB가 같습니다.');
        pairs[name] = { source: source[0].id, target: target[0].id };
    }
    if (!Object.keys(pairs).length) throw new Error('이전 가능한 DB가 없습니다. 개별 템플릿의 접근 권한을 확인해주세요.');
    return { template: templates[0], pairs, skipped };
}

// No query restriction: detection must see mixed template types and all pages.
export async function discoverTransferDatabases(accessToken: string): Promise<TransferDatabase[]> {
    const databases: TransferDatabase[] = [];
    let cursor: string | undefined;
    do {
        const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
            body: JSON.stringify({ filter: { property: 'object', value: 'database' }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
        });
        if (!response.ok) throw new Error(`DB 검색에 실패했습니다 (${response.status}). 잠시 후 다시 점검해주세요.`);
        const data = await response.json();
        for (const item of data.results) {
            if (!item.archived && !item.in_trash) databases.push({ id: item.id, title: (item.title || []).map((part: any) => part.plain_text ?? part.text?.content ?? '').join('') });
        }
        cursor = data.has_more ? data.next_cursor : undefined;
        if (data.has_more && !cursor) throw new Error('DB 검색 결과가 불완전합니다. 다시 점검해주세요.');
    } while (cursor);
    return databases;
}
