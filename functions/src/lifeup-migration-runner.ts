import * as admin from 'firebase-admin';
import { Client, LogLevel } from '@notionhq/client';
import { randomUUID } from 'crypto';

const STALE_MS = 5 * 60 * 1000;
const LEGACY_TIMEOUT_MS = 60 * 60 * 1000;
const MOVE_CONFIRM_ATTEMPTS = 3;
const MOVE_CONFIRM_DELAY_MS = 1000;
const TEMPLATE_CONFIRM_ATTEMPTS = 5;
interface PageInfo {
    id: string;
    title: string;
    properties?: Record<string, {
        type?: string;
        checkbox?: boolean;
    }>;
}
type DatabaseInfo = {
    dbNames?: Record<string, string>;
    defaultMigration?: string;
    defaultProperty?: string;
    refreshContentWithDefaultTemplate?: boolean;
    restoreTemplateContent?: boolean;
    excludedTemplateSections?: string[];
};
interface Dependencies {
    entries: [string, DatabaseInfo][];
    resolve: (name: string, version: string) => Promise<string | null>;
    pages: (dataSourceId: string) => Promise<PageInfo[]>;
}

type TemplateSection = { title: string; callout: any; children: any[] };

// Blocks returned by Notion that cannot be created with blocks.children.append
// (for example child_database) must not be sent back as normal content.
const appendableBlockTypes = new Set([
    'embed', 'bookmark', 'image', 'video', 'pdf', 'file', 'audio', 'code', 'equation',
    'divider', 'breadcrumb', 'tab', 'table_of_contents', 'link_to_page', 'table_row',
    'ai_block', 'meeting_notes', 'custom_block', 'table', 'column_list', 'column',
    'heading_1', 'heading_2', 'heading_3', 'heading_4', 'paragraph',
    'bulleted_list_item', 'numbered_list_item', 'quote', 'to_do', 'toggle', 'template',
    'callout', 'synced_block'
]);

const sectionBullet = /^\s*[▫▪◽◾◻◼◦•]\s*/;
const blockText = (block: any): string => {
    const richText = block?.[block?.type]?.rich_text;
    return Array.isArray(richText) ? richText.map((item: any) => item.plain_text || item.text?.content || '').join('') : '';
};
const sectionTitle = (block: any): string | null => {
    if (!block?.[block?.type]?.rich_text) return null;
    const text = blockText(block).trim();
    return sectionBullet.test(text) ? text.replace(sectionBullet, '').trim() || null : null;
};
const calloutPayload = (block: any) => {
    const { icon, ...callout } = block.callout || {};
    // Notion returns icon: null for callouts without an icon, but its update
    // endpoint accepts an icon object or an omitted field only.
    return { callout: icon ? { ...callout, icon } : callout };
};
const appendBlockPayload = (block: any): any => {
    const content = block?.[block?.type];
    if (!block?.type || !content) {
        throw new MigrationUserError('복원할 수 없는 블록 형식이 포함되어 있습니다.');
    }
    const safeContent = block.type === 'callout' ? calloutPayload(block).callout : { ...content };
    return {
        object: 'block',
        type: block.type,
        [block.type]: safeContent
    };
};
const nestedBlockSummary = (blocks: any[]): { count: number; types: string[] } => {
    const types: string[] = [];
    const visit = (items: any[]) => items.forEach(block => {
        types.push(block.type || 'unknown');
        if (Array.isArray(block.children)) visit(block.children);
    });
    visit(blocks);
    return { count: types.length, types };
};
const unsupportedAppendBlockTypes = (blocks: any[]): string[] => {
    const types = new Set<string>();
    const visit = (items: any[]) => items.forEach(block => {
        if (block?.type && !appendableBlockTypes.has(block.type)) {
            const unsupportedType = block.type === 'unsupported'
                ? block.unsupported?.block_type || 'unknown'
                : block.type;
            types.add(block.type === 'unsupported' ? `unsupported (${unsupportedType})` : unsupportedType);
        }
        if (Array.isArray(block?.children)) visit(block.children);
    });
    visit(blocks);
    return [...types];
};
const omitIgnoredTemplateBlocks = (blocks: any[]): any[] => blocks.flatMap(block => {
    // These blocks are intentionally not part of the preserved template content.
    if (block?.type === 'child_database' || block?.type === 'unsupported') return [];
    const copy = { ...block };
    if (Array.isArray(block?.children)) copy.children = omitIgnoredTemplateBlocks(block.children);
    return [copy];
});
export class MigrationConflict extends Error { }
class MigrationUserError extends Error { }
class WorkerStopped extends Error { }

// Keep SDK diagnostics in server logs; only these messages are shown to users.
export function migrationErrorMessage(error: any): string {
    if (error instanceof MigrationConflict || error instanceof MigrationUserError) {
        return error.message;
    }

    const status = Number(error?.status);
    const code = error?.code;
    if (status >= 500 && status <= 599) {
        return '노션 서버와의 통신에 일시적인 문제가 발생했습니다. 잠시 후 재시작하면 미완료 페이지부터 이어서 진행합니다.';
    }
    if (status === 429 || code === 'rate_limited') {
        return '노션 요청이 일시적으로 많아 처리가 지연되었습니다. 잠시 후 재시작해주세요.';
    }
    if (code === 'notionhq_client_request_timeout' || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
        return '노션 응답을 기다리는 시간이 길어 처리를 완료하지 못했습니다. 잠시 후 재시작해주세요.';
    }
    if (status === 401 || code === 'unauthorized') {
        return '노션 연결 인증을 확인할 수 없습니다. 노션 연결 상태를 확인해주세요.';
    }
    if (status === 403 || code === 'restricted_resource') {
        return '노션 페이지에 접근할 권한이 없습니다. 연결된 계정의 접근 권한을 확인해주세요.';
    }
    if (status === 404 || code === 'object_not_found') {
        return '노션 페이지 또는 데이터베이스를 찾을 수 없습니다. 삭제 여부와 공유 권한을 확인해주세요.';
    }
    if (code === 'validation_error') {
        return '노션에서 일부 속성 또는 연결 정보를 처리하지 못했습니다. 페이지의 이전 여부를 확인해주세요.';
    }
    if (status === 400) {
        return '노션에서 이전 요청을 처리할 수 없습니다. 같은 문제가 계속되면 고객지원에 문의해주세요.';
    }
    return '데이터 이전을 완료하지 못했습니다. 재시작 후에도 같은 문제가 계속되면 고객지원에 문의해주세요.';
}
const millis = (value: any): number => value?.toMillis?.() || 0;
const normalizeId = (value: string) => value.replace(/-/g, '');
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

// Legacy workers do not understand leases: wait out their maximum invocation lifetime.
function expiresAt(run: any): number {
    return millis(run.leaseExpiresAt) || millis(run.createdAt) + LEGACY_TIMEOUT_MS;
}

export async function executeMigration(
    db: admin.firestore.Firestore,
    userId: string,
    accessToken: string,
    requestedRunId: string | undefined,
    action: string,
    dependencies: Dependencies
) {
    const parent = db.collection('users').doc(userId).collection('integrations').doc('migration');
    const owner = randomUUID();
    const claimed = await db.runTransaction(async tx => {
        const parentSnap = await tx.get(parent);
        const latestId = parentSnap.data()?.migrationRunId;
        if (requestedRunId && latestId && requestedRunId !== latestId) {
            throw new MigrationConflict('최신 이전 작업만 재시작할 수 있습니다. 새로고침해주세요.');
        }
        const runId = requestedRunId || latestId || randomUUID();
        const ref = parent.collection('migration').doc(runId);
        const snapshot = await tx.get(ref);
        const run = snapshot.data();
        const running = run && ['migrating', 'stopping'].includes(run.status) && expiresAt(run) > Date.now();
        if (action === 'stop') {
            if (!run) {
                throw new MigrationConflict('이전 기록을 찾을 수 없습니다.');
            }
            if (running && !run.workerId) {
                throw new MigrationConflict('이전 버전 작업은 즉시 중단할 수 없습니다. 기존 실행 제한시간이 지난 뒤 재시작해주세요.');
            }
            if (run.status === 'complete' && run.success) {
                return { runId, execute: false };
            }
            tx.update(ref, running
                ? { stopRequested: true, status: 'stopping' }
                : {
                    stopRequested: true,
                    status: 'stopped',
                    workerId: null,
                    leaseExpiresAt: admin.firestore.Timestamp.fromMillis(0)
                });
            return { runId, execute: false };
        }
        if (running) {
            throw new MigrationConflict('서버에서 작업 중입니다. 마지막 작업 갱신 후 5분이 지나면 재시작할 수 있습니다.');
        }
        if (run?.status === 'complete' && run.success) {
            return { runId, execute: false };
        }
        tx.set(ref, {
            runId,
            workerId: owner,
            status: 'migrating',
            success: false,
            stopRequested: false,
            restartTimeoutMs: STALE_MS,
            phase: 'counting',
            totalCountReady: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + STALE_MS),
            error: admin.firestore.FieldValue.delete(),
            ...(run ? {} : {
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                totalCount: 0,
                completedCount: 0
            })
        }, { merge: true });
        tx.set(parent, { migrationRunId: runId }, { merge: true });
        return { runId, execute: true };
    });
    if (!claimed.execute) {
        return { success: true, runId: claimed.runId };
    }

    const run = parent.collection('migration').doc(claimed.runId);
    const pagesRef = run.collection('pages');
    const resultsRef = run.collection('results');
    const startedAt = Date.now();
    // Every write is fenced by ownership. A timed-out worker cannot overwrite its successor.
    const commit = async (write: (tx: admin.firestore.Transaction) => void, allowStop = false) => {
        const writeStartedAt = Date.now();
        const stopped = await db.runTransaction(async tx => {
            const data = (await tx.get(run)).data();
            if (data?.workerId !== owner || expiresAt(data) <= Date.now()) {
                throw new WorkerStopped();
            }
            if (data.stopRequested && !allowStop) {
                tx.update(run, {
                    status: 'stopped',
                    workerId: null,
                    leaseExpiresAt: admin.firestore.Timestamp.fromMillis(0)
                });
                return true;
            }
            tx.update(run, {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + STALE_MS)
            });
            write(tx);
            return false;
        });
        console.log(`[Migration] runId=${claimed.runId} FIRESTORE CHECKPOINT elapsed=${Date.now() - writeStartedAt}ms`);
        if (stopped) {
            throw new WorkerStopped();
        }
    };
    const checkpoint = () => commit(() => {
        if (Date.now() - startedAt > 55 * 60 * 1000) {
            throw new MigrationUserError('실행 시간이 길어 작업을 일시 중단했습니다. 재시작하면 이어서 진행합니다.');
        }
    });
    const timed = async <T>(stage: string, operation: () => Promise<T>): Promise<T> => {
        await checkpoint();
        const start = Date.now();
        console.log(`[Migration] runId=${claimed.runId} ${stage} START`);
        try {
            return await operation();
        } finally {
            console.log(`[Migration] runId=${claimed.runId} ${stage} elapsed=${Date.now() - start}ms`);
        }
    };
    const notion = new Client({
        auth: accessToken,
        timeoutMs: 30000,
        retry: { maxRetries: 2, maxRetryDelayMs: 10000 },
        logLevel: LogLevel.INFO,
        logger: (level, message, details) => {
            if (message === 'retrying request' || level === LogLevel.WARN || level === LogLevel.ERROR) {
                console.log('[Migration] NOTION SDK', {
                    runId: claimed.runId,
                    level,
                    message,
                    path: details.path,
                    attempt: details.attempt,
                    delayMs: details.delayMs,
                    code: details.code,
                    status: details.status
                });
            }
        }
    });
    const listBlocks = async (pageId: string): Promise<any[]> => {
        const blocks: any[] = [];
        let cursor: string | undefined;
        do {
            const response: any = await timed(`NOTION LIST BLOCKS page=${pageId}`, () =>
                notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 })
            );
            blocks.push(...response.results);
            cursor = response.has_more ? response.next_cursor || undefined : undefined;
        } while (cursor);
        return blocks;
    };
    const templateSections = (blocks: any[]): TemplateSection[] => {
        const sections: TemplateSection[] = [];
        for (let index = 0; index < blocks.length - 1; index++) {
            const title = sectionTitle(blocks[index]);
            if (title && blocks[index + 1]?.type === 'callout') {
                sections.push({ title, callout: blocks[index + 1], children: [] });
                index++;
            }
        }
        return sections;
    };
    const readBlockTree = async (blockId: string): Promise<any[]> => {
        const children = await listBlocks(blockId);
        for (const child of children) {
            if (child.has_children) {
                child.children = await readBlockTree(child.id);
            }
        }
        return children;
    };
    const appendBlockTree = async (parentId: string, blocks: any[], stage: string): Promise<void> => {
        for (const block of blocks) {
            const response: any = await timed(`${stage} type=${block.type}`, () =>
                notion.blocks.children.append({ block_id: parentId, children: [appendBlockPayload(block)] })
            );
            const appendedId = response?.results?.[0]?.id;
            if (!appendedId) {
                throw new MigrationUserError('복원한 블록의 ID를 확인하지 못했습니다. 재시작하면 이 페이지부터 다시 확인합니다.');
            }
            if (Array.isArray(block.children) && block.children.length) {
                await appendBlockTree(appendedId, block.children, stage);
            }
        }
    };
    try {
        const saved = await pagesRef.get();
        const manifest = new Map(saved.docs.map(doc => [doc.id, { ...doc.data(), pageId: doc.id }] as [string, any]));
        let completed = [...manifest.values()].filter(page => page.status === 'complete').length;
        const oldResults = await resultsRef.orderBy('order', 'desc').limit(1).get();
        let order = (oldResults.docs[0]?.data().order ?? -1) + 1;
        let success = true;
        let completedDbs = 0;
        const databases: Array<{
            dbName: string;
            source: string;
            target: string;
            info: DatabaseInfo;
            targetPagesByTitle: Map<string, PageInfo[]>;
        }> = [];
        const notify = async (message: string, dbName = '전체 집계') => {
            console.log(`[Migration] runId=${claimed.runId} ${dbName}: ${message}`);
            const notificationOrder = order++;
            await commit(tx => tx.set(resultsRef.doc(`counting_${notificationOrder}`), {
                dbName,
                message,
                status: 'notification',
                type: 'counting',
                order: notificationOrder,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }));
        };
        await notify('전체 DB의 이전 대상 개수를 집계합니다. 집계가 끝난 뒤 페이지 이동을 시작합니다.');
        await commit(tx => tx.update(run, {
            completedCount: completed,
            totalDbCount: dependencies.entries.length,
            completedDbCount: 0
        }));
        // Discover every database before moving. Saved successes no longer appear in the source.
        for (const [dbName, info] of dependencies.entries) {
            await notify('이전 대상 조회 중...', dbName);
            const source = await timed(`RESOLVE SOURCE db=${dbName}`, () => dependencies.resolve(dbName, '1.3'));
            const target = await timed(`RESOLVE TARGET db=${dbName}`, () => dependencies.resolve(dbName, '1.5'));
            if (!source || !target) {
                throw new MigrationUserError(`${dbName} 원본 또는 대상 DB를 찾을 수 없습니다.`);
            }
            const remaining = await timed(`PAGES FETCH db=${dbName}`, () => dependencies.pages(source));
            const targetPages = info.defaultMigration === 'replace' ? await timed(`TARGET PAGES FETCH db=${dbName}`, () => dependencies.pages(target))
                : [];
            const targetPagesByTitle = new Map<string, PageInfo[]>();
            for (const targetPage of targetPages) {
                // replace only removes 1.5 template defaults. A user-created page with the
                // same title must never be archived simply because an old page is moving in.
                if (!info.defaultProperty || targetPage.properties?.[info.defaultProperty]?.checkbox !== true) {
                    continue;
                }
                const matches = targetPagesByTitle.get(targetPage.title) || [];
                matches.push(targetPage);
                targetPagesByTitle.set(targetPage.title, matches);
            }
            const excluded = remaining.filter(page =>
                info.defaultMigration === 'none' && info.defaultProperty &&
                page.properties?.[info.defaultProperty]?.checkbox === true
            );
            const excludedIds = new Set(excluded.map(page => page.id));
            // Also remove default items queued by an older worker before a restart.
            for (const page of excluded) {
                const existing = manifest.get(page.id);
                if (existing && existing.status !== 'complete') {
                    const skippedOrder = order++;
                    await commit(tx => {
                        tx.update(pagesRef.doc(page.id), { status: 'skipped' });
                        tx.set(resultsRef.doc(`page_${page.id}`), {
                            dbName,
                            pageId: page.id,
                            status: 'notification',
                            type: 'page-skipped',
                            message: `${page.title} — 기본 항목으로 이전 제외`,
                            order: skippedOrder,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    existing.status = 'skipped';
                }
            }
            const additions = remaining.filter(page => !excludedIds.has(page.id) &&
                (!manifest.has(page.id) || manifest.get(page.id).status === 'skipped'));
            for (let offset = 0; offset < additions.length; offset += 400) {
                const chunk = additions.slice(offset, offset + 400);
                await timed(`FIRESTORE PREPARE db=${dbName} count=${chunk.length}`, () => commit(tx => {
                    for (const page of chunk) {
                        tx.set(pagesRef.doc(page.id), {
                            dbName,
                            pageId: page.id,
                            pageName: page.title || '이름 없는 페이지',
                            status: 'pending',
                            retryCount: 0,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }));
                for (const page of chunk) {
                    manifest.set(page.id, {
                        dbName,
                        pageId: page.id,
                        pageName: page.title || '이름 없는 페이지',
                        status: 'pending'
                    });
                }
            }
            databases.push({
                dbName,
                source,
                target,
                info,
                targetPagesByTitle
            });
            const databaseCount = [...manifest.values()].filter(page =>
                page.dbName === dbName && page.status !== 'skipped').length;
            await notify(`집계 완료: 이전 대상 ${databaseCount}개 (기본 항목 ${excluded.length}개 제외)`, dbName);
        }
        const totalCount = [...manifest.values()].filter(page => page.status !== 'skipped').length;
        await commit(tx => tx.update(run, {
            totalCount,
            completedCount: completed,
            totalCountReady: true,
            phase: 'moving'
        }));
        await notify(`전체 집계 완료: 총 ${totalCount}개, 완료 ${completed}개, 남은 ${totalCount - completed}개`);

        for (const { dbName, source, target, info, targetPagesByTitle } of databases) {
            try {
                const databasePages = [...manifest.values()].filter(page =>
                    page.dbName === dbName && page.status !== 'skipped');
                let incompleteCount = 0;
                for (let index = 0; index < databasePages.length; index++) {
                    const page = databasePages[index];
                    if (page.status === 'complete') {
                        continue;
                    }
                    await checkpoint();
                    const pageRef = pagesRef.doc(page.pageId);
                    const resultRef = resultsRef.doc(`page_${page.pageId}`);
                    const resultOrder = order++;
                    const result = {
                        dbName,
                        pageId: page.pageId,
                        pageName: page.pageName,
                        message: page.pageName,
                        current: index + 1,
                        total: databasePages.length,
                        count: 1,
                        order: resultOrder,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    let templateRestoreStarted = false;
                    let templateContentRestoring = false;
                    try {
                        // A move may have succeeded immediately before a crash or a lost HTTP response.
                        let alreadyMoved = false;
                        if (page.status === 'migrating' || page.status === 'error') {
                            const current = await timed(`NOTION VERIFY page=${page.pageId}`, () => notion.pages.retrieve({ page_id: page.pageId }));
                            if (!('parent' in current)) {
                                throw new MigrationUserError('페이지의 현재 위치를 확인할 수 없습니다.');
                            }
                            const currentParent = current.parent;
                            alreadyMoved = currentParent.type === 'data_source_id' &&
                                normalizeId(currentParent.data_source_id) === normalizeId(target);
                            const stillInSource = currentParent.type === 'data_source_id' &&
                                normalizeId(currentParent.data_source_id) === normalizeId(source);
                            if (!alreadyMoved && !stillInSource) {
                                throw new MigrationUserError('페이지가 원본/대상 외의 위치에 있습니다. 위치를 확인해주세요.');
                            }
                        }
                        if (!alreadyMoved) {
                            await commit(tx => tx.update(pageRef, { status: 'migrating', updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
                            await timed(`NOTION MOVE db=${dbName} page=${page.pageId}`, () => notion.pages.move({
                                page_id: page.pageId, parent: { type: 'data_source_id', data_source_id: target }
                            }));
                        }
                        if (info.defaultMigration === 'replace') {
                            const sameNamePages = targetPagesByTitle.get(page.pageName) || [];
                            for (const targetPage of sameNamePages.filter(candidate => candidate.id !== page.pageId)) {
                                await timed(`NOTION ARCHIVE REPLACED DEFAULT db=${dbName} page=${targetPage.id}`, () =>
                                    notion.pages.update({ page_id: targetPage.id, archived: true })
                                );
                            }
                            // A retry must not archive the same target default twice.
                            targetPagesByTitle.set(page.pageName, sameNamePages.filter(candidate => candidate.id === page.pageId));
                        }
                        if (info.refreshContentWithDefaultTemplate && !page.templateApplied) {
                            templateRestoreStarted = true;
                            // Read these before erase_content. Only marked title/callout pairs are user template sections.
                            const originalBlocks = await timed(
                                `NOTION SAVE TEMPLATE SECTIONS db=${dbName} page=${page.pageId}`,
                                () => listBlocks(page.pageId)
                            );
                            const excludedSections = new Set((info.excludedTemplateSections || []).map(title => title.trim()));
                            const preservedSections = info.restoreTemplateContent === true
                                ? templateSections(originalBlocks).filter(section => !excludedSections.has(section.title.trim()))
                                : [];
                            for (const section of preservedSections) {
                                section.children = section.callout.has_children
                                    ? await readBlockTree(section.callout.id)
                                    : [];
                            }
                            for (const section of preservedSections) {
                                section.children = omitIgnoredTemplateBlocks(section.children);
                            }
                            const unsupportedTypes = unsupportedAppendBlockTypes(
                                preservedSections.flatMap(section => section.children)
                            );
                            if (unsupportedTypes.length) {
                                const warning = `템플릿 보존 영역에 노션에서 복원할 수 없는 블록(${unsupportedTypes.join(', ')})이 있어 템플릿 적용을 건너뛰었습니다. 페이지 이동과 기존 내용은 유지되었습니다.`;
                                console.warn('[Migration] template refresh skipped for unsupported block type', {
                                    runId: claimed.runId,
                                    dbName,
                                    pageId: page.pageId,
                                    unsupportedTypes
                                });
                                await commit(tx => {
                                    tx.update(pageRef, {
                                        status: 'complete',
                                        completedWithWarning: true,
                                        templateApplied: false,
                                        templateSkippedReason: warning,
                                        templateApplying: admin.firestore.FieldValue.delete(),
                                        errorMessage: admin.firestore.FieldValue.delete(),
                                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                    });
                                    tx.set(resultRef, {
                                        ...result,
                                        status: 'warning',
                                        type: 'page-warning',
                                        message: `${page.pageName} · ${warning}`
                                    });
                                    tx.update(run, { completedCount: completed + 1 });
                                }, true);
                                completed++;
                                page.status = 'complete';
                                continue;
                            }
                            const originalBlockIds = new Set(originalBlocks.map(block => block.id).filter(Boolean));
                            console.log('[Migration] template sections saved', {
                                runId: claimed.runId,
                                dbName,
                                pageId: page.pageId,
                                blockCount: originalBlocks.length,
                                sections: preservedSections.map(section => ({
                                    title: section.title,
                                    ...nestedBlockSummary(section.children)
                                }))
                            });
                            let movedToTarget = alreadyMoved;
                            for (let attempt = 0; attempt < MOVE_CONFIRM_ATTEMPTS && !movedToTarget; attempt++) {
                                if (attempt > 0) {
                                    await wait(MOVE_CONFIRM_DELAY_MS);
                                }
                                const current = await timed(
                                    `NOTION VERIFY MOVE db=${dbName} page=${page.pageId} attempt=${attempt + 1}`,
                                    () => notion.pages.retrieve({ page_id: page.pageId })
                                );
                                const parent = 'parent' in current ? current.parent : undefined;
                                movedToTarget = parent?.type === 'data_source_id' &&
                                    normalizeId(parent.data_source_id) === normalizeId(target);
                            }
                            if (!movedToTarget) {
                                throw new MigrationUserError('페이지 이동 완료를 확인하지 못했습니다. 재시작하면 이 페이지부터 다시 확인합니다.');
                            }
                            // Notion replaces old blocks with the 1.5 default template in one request.
                            await commit(tx => tx.update(pageRef, {
                                status: 'migrating',
                                templateApplying: true,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            }));
                            await timed(`NOTION APPLY TEMPLATE db=${dbName} page=${page.pageId}`, () => notion.pages.update({
                                page_id: page.pageId,
                                erase_content: true,
                                template: { type: 'default' }
                            }));
                            // Applying a Notion template can be asynchronous. This poll only delays
                            // restoration; block IDs are not a reliable completion signal because
                            // Notion can update a block in place.
                            let allNewBlocks: any[] = [];
                            let templateReady = originalBlockIds.size === 0;
                            for (let attempt = 0; attempt < TEMPLATE_CONFIRM_ATTEMPTS; attempt++) {
                                if (attempt > 0) await wait(MOVE_CONFIRM_DELAY_MS);
                                allNewBlocks = await listBlocks(page.pageId);
                                const currentIds = new Set(allNewBlocks.map(block => block.id).filter(Boolean));
                                templateReady = originalBlockIds.size === 0 ||
                                    (allNewBlocks.length > 0 && [...originalBlockIds].every(id => !currentIds.has(id)));
                                if (templateReady) break;
                            }
                            if (!templateReady) {
                                console.warn('[Migration] template replacement was not confirmed; restoring after wait', {
                                    runId: claimed.runId,
                                    dbName,
                                    pageId: page.pageId,
                                    originalBlockCount: originalBlockIds.size,
                                    lastVisibleBlockCount: allNewBlocks.length
                                });
                            }
                            console.log('[Migration] template restoration begins', {
                                runId: claimed.runId,
                                dbName,
                                pageId: page.pageId,
                                newBlockCount: allNewBlocks.length,
                                templateReplacementConfirmed: templateReady
                            });
                            const targetSections = new Map<string, any>();
                            for (let index = 0; index < allNewBlocks.length - 1; index++) {
                                const title = sectionTitle(allNewBlocks[index]);
                                if (title && allNewBlocks[index + 1]?.type === 'callout') {
                                    targetSections.set(title, allNewBlocks[index + 1]);
                                    index++;
                                }
                            }
                            for (const preserved of preservedSections) {
                                templateContentRestoring = true;
                                const targetSection = targetSections.get(preserved.title);
                                if (targetSection) {
                                    const summary = nestedBlockSummary(preserved.children);
                                    console.log('[Migration] restoring template section', {
                                        runId: claimed.runId, dbName, pageId: page.pageId,
                                        // Do not clear the new template's content. An empty old
                                        // section can be an intentional user deletion; clearing the
                                        // matching new section would incorrectly carry that deletion
                                        // forward. Keep the template and append preserved content.
                                        title: preserved.title, mode: 'append-to-callout', blockId: targetSection.id,
                                        restoredChildCount: summary.count,
                                        restoredChildTypes: summary.types
                                    });
                                    await timed(`NOTION RESTORE TEMPLATE SECTION db=${dbName} page=${page.pageId}`, () =>
                                        notion.blocks.update({ block_id: targetSection.id, ...calloutPayload(preserved.callout) })
                                    );
                                    if (preserved.children.length) {
                                        await appendBlockTree(
                                            targetSection.id,
                                            preserved.children,
                                            `NOTION RESTORE TEMPLATE SECTION CHILDREN db=${dbName} page=${page.pageId}`
                                        );
                                    }
                                } else {
                                    const summary = nestedBlockSummary(preserved.children);
                                    console.log('[Migration] restoring template section', {
                                        runId: claimed.runId, dbName, pageId: page.pageId,
                                        title: preserved.title, mode: 'append-section',
                                        restoredChildCount: summary.count,
                                        restoredChildTypes: summary.types
                                    });
                                    const callout = calloutPayload(preserved.callout).callout;
                                    await appendBlockTree(page.pageId, [{
                                        object: 'block', type: 'paragraph',
                                        paragraph: { rich_text: [{ type: 'text', text: { content: `▫ ${preserved.title}` } }] }
                                    }, {
                                        object: 'block', type: 'callout', callout,
                                        children: preserved.children
                                    }], `NOTION APPEND TEMPLATE SECTION db=${dbName} page=${page.pageId}`
                                    );
                                }
                            }
                            page.templateApplied = true;
                        }
                        // Save an in-flight move's result even if a stop was requested during the call.
                        await commit(tx => {
                            tx.update(pageRef, {
                                status: 'complete',
                                templateApplied: page.templateApplied === true,
                                completedWithWarning: admin.firestore.FieldValue.delete(),
                                templateSkippedReason: admin.firestore.FieldValue.delete(),
                                templateApplying: admin.firestore.FieldValue.delete(),
                                errorMessage: admin.firestore.FieldValue.delete(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            tx.set(resultRef, {
                                ...result,
                                status: 'ok',
                                type: 'page-complete'
                            });
                            tx.update(run, { completedCount: completed + 1 });
                        }, true);
                        completed++;
                        page.status = 'complete';
                        console.log(`[Migration] runId=${claimed.runId} PAGE COMPLETE db=${dbName} page=${page.pageId} completed=${completed} total=${totalCount}`);
                    } catch (error: any) {
                        if (error instanceof WorkerStopped) {
                            throw error;
                        }
                        // Notion can reject a property validation after it has already moved
                        // the page. Treat that as a completed move with a warning only after
                        // verifying that the page is no longer in the source data source.
                        if (error?.code === 'validation_error' && !templateRestoreStarted) {
                            try {
                                const current: any = await timed(
                                    `NOTION VERIFY VALIDATION ERROR db=${dbName} page=${page.pageId}`,
                                    () => notion.pages.retrieve({ page_id: page.pageId })
                                );
                                const currentParent = 'parent' in current ? current.parent : undefined;
                                const removedFromSource = currentParent?.type === 'data_source_id' &&
                                    normalizeId(currentParent.data_source_id) !== normalizeId(source);
                                if (removedFromSource) {
                                    const warning = '노션에서 일부 속성 또는 연결 정보를 처리하지 못했지만 페이지 이동은 완료되었습니다. 필요하면 페이지의 관계 속성을 확인해주세요.';
                                    console.warn('[Migration] validation warning after moved page', {
                                        runId: claimed.runId, dbName, pageId: page.pageId,
                                        parent: currentParent.data_source_id, message: error?.message
                                    });
                                    await commit(tx => {
                                        tx.update(pageRef, {
                                            status: 'complete',
                                            completedWithWarning: true,
                                            templateApplying: admin.firestore.FieldValue.delete(),
                                            errorMessage: admin.firestore.FieldValue.delete(),
                                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                        });
                                        tx.set(resultRef, {
                                            ...result,
                                            status: 'warning',
                                            type: 'page-warning',
                                            message: `${page.pageName} — ${warning}`
                                        });
                                        tx.update(run, { completedCount: completed + 1 });
                                    }, true);
                                    completed++;
                                    page.status = 'complete';
                                    continue;
                                }
                            } catch (verifyError: any) {
                                if (verifyError instanceof WorkerStopped) throw verifyError;
                                console.error('[Migration] validation-error verification failed', {
                                    runId: claimed.runId, dbName, pageId: page.pageId, message: verifyError?.message
                                });
                            }
                        }
                        // The page move has already completed before template preservation starts.
                        // If an old template block cannot be restored into the new template,
                        // keep the moved page complete and make the follow-up explicit instead
                        // of counting it as a migration failure.
                        if (templateContentRestoring) {
                            const warning = '페이지 이동은 완료되었지만 일부 템플릿은 완전히 이전되지 않았습니다. 이전 버전에서 확인해주세요.';
                            console.warn('[Migration] template restoration completed with warning', {
                                runId: claimed.runId,
                                dbName,
                                pageId: page.pageId,
                                status: error?.status,
                                code: error?.code,
                                message: error?.message
                            });
                            await commit(tx => {
                                tx.update(pageRef, {
                                    status: 'complete',
                                    completedWithWarning: true,
                                    templateApplied: false,
                                    templateSkippedReason: warning,
                                    templateApplying: admin.firestore.FieldValue.delete(),
                                    errorMessage: admin.firestore.FieldValue.delete(),
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                                tx.set(resultRef, {
                                    ...result,
                                    status: 'warning',
                                    type: 'page-warning',
                                    message: `${page.pageName} · ${warning}`
                                });
                                tx.update(run, { completedCount: completed + 1 });
                            }, true);
                            completed++;
                            page.status = 'complete';
                            continue;
                        }
                        success = false;
                        incompleteCount++;
                        const message = migrationErrorMessage(error);
                        console.error('[Migration] page failed', {
                            runId: claimed.runId, dbName, pageId: page.pageId,
                            status: error?.status, code: error?.code, message: error?.message
                        });
                        await commit(tx => {
                            tx.update(pageRef, {
                                status: 'error',
                                errorMessage: message,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            tx.set(resultRef, {
                                ...result,
                                status: 'error',
                                type: 'page-error',
                                message: `${page.pageName} — ${message}`
                            });
                        }, true);
                    }
                }
                const dbSuccess = incompleteCount === 0;
                if (dbSuccess) {
                    completedDbs++;
                }
                const databaseOrder = order++;
                await commit(tx => {
                    tx.set(resultsRef.doc(`database_${dbName.replace(/\//g, '_')}`), {
                        dbName,
                        type: 'database-complete',
                        status: dbSuccess ? 'ok' : 'error',
                        incompleteCount,
                        message: dbSuccess ? '데이터베이스 이전 완료'
                            : `데이터베이스 중 ${incompleteCount}개의 페이지 이전이 완료되지 않았습니다.`,
                        order: databaseOrder,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    tx.update(run, { completedDbCount: completedDbs });
                });
            } catch (error: any) {
                if (error instanceof WorkerStopped) {
                    throw error;
                }
                success = false;
                console.error('[Migration] database failed', {
                    runId: claimed.runId, dbName, message: error?.message
                });
                const databaseOrder = order++;
                await commit(tx => tx.set(resultsRef.doc(`database_${dbName.replace(/\//g, '_')}`), {
                    dbName,
                    type: 'error',
                    status: 'error',
                    message: migrationErrorMessage(error),
                    order: databaseOrder,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }));
            }
        }
        await commit(tx => tx.update(run, {
            status: 'complete',
            success,
            completedCount: completed,
            totalCount,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            workerId: null,
            leaseExpiresAt: admin.firestore.Timestamp.fromMillis(0)
        }));
    } catch (error: any) {
        if (!(error instanceof WorkerStopped)) {
            console.error('[Migration] worker failed', { runId: claimed.runId, message: error.message });
            await db.runTransaction(async tx => {
                const data = (await tx.get(run)).data();
                if (data?.workerId === owner) {
                    tx.update(run, {
                        status: 'error',
                        success: false,
                        error: migrationErrorMessage(error),
                        workerId: null,
                        leaseExpiresAt: admin.firestore.Timestamp.fromMillis(0)
                    });
                }
            });
        }
    }
    return { success: true, runId: claimed.runId };
}
