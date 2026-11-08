import { firestore } from 'firebase-admin';
import { Client } from '@notionhq/client';
import { randomUUID } from 'crypto';
import { RecurringSchedule, isScheduleDue, koreaDate, occurrenceKey, scheduleConflict, validateSchedule } from './recurring-schedule-model';

const KEY = '자동생성 키';
type Firestore = firestore.Firestore;
const FieldValue = firestore.FieldValue;
type Dependencies = {
    db: Firestore;
    resolveDatabase: (token: string, userId: string) => Promise<string>;
    resolveSource: (token: string, databaseId: string) => Promise<string>;
    assertConnection: (userId: string, token: string, connectionId: any) => Promise<unknown>;
    allowed: (workspace: any) => boolean;
    writeEvent?: (uid: string, event: { status: 'running' | 'completed' | 'failed'; eventTitle: string; description: string; targetData?: Record<string, unknown> }) => Promise<void>;
};
export function createRecurringSchedules(deps: Dependencies) {
    const { db } = deps;
    const root = (uid: string) => db.collection('users').doc(uid).collection('integrations').doc('recurringSchedules');
    async function connection(uid: string, setup = false) {
        const workspace = (await db.collection('users').doc(uid).get()).data();
        if (!workspace || workspace.deletionStatus === 'archived' || !deps.allowed(workspace) || !workspace.notionAccessToken) throw new Error("지원하는 템플릿의 노션 연결이 필요합니다.");
        const token = workspace.notionAccessToken;
        await deps.assertConnection(uid, token, workspace.notionConnectionId);
        const notion = new Client({ auth: token, timeoutMs: 20000, retry: false });
        const databaseId = await deps.resolveDatabase(token, uid);
        const sourceId = await deps.resolveSource(token, databaseId);
        const schema: any = await notion.dataSources.retrieve({ data_source_id: sourceId });
        for (const [name, type] of [['할일','title'],['날짜','date'],['유형','status'],['분류','select']]) {
            if (schema.properties?.[name]?.type !== type) throw new Error("할일 DB 속성을 확인해주세요: " + name);
        }
        if (!schema.properties[KEY] && setup) {
            await deps.assertConnection(uid, token, workspace.notionConnectionId);
            await notion.dataSources.update({ data_source_id: sourceId, properties: { [KEY]: { rich_text: {} } } });
        } else if (schema.properties[KEY]?.type !== 'rich_text') throw new Error("자동생성 키 텍스트 속성이 필요합니다. 연결 준비를 다시 실행해주세요.");
        return { notion, sourceId, token, connectionId: workspace.notionConnectionId };
    }
    async function state(uid: string) {
        const [config, schedules, receipts] = await Promise.all([root(uid).get(), root(uid).collection('schedules').get(), root(uid).collection('occurrences').orderBy('updatedAt','desc').limit(30).get()]);
        return { enabled: config.data()?.enabled === true, sourceId: config.data()?.sourceId || '',
            schedules: schedules.docs.map(d => ({ ...d.data(), id: d.id })),
            receipts: receipts.docs.map(d => ({ id: d.id, status: d.data().status, date: d.data().date, name: d.data().name, pageId: d.data().pageId || '' })) };
    }
    async function save(uid: string, value: any) {
        const error = validateSchedule(value);
        if (error) throw new Error(error);
        const ref = value.id ? root(uid).collection('schedules').doc(value.id) : root(uid).collection('schedules').doc();
        await db.runTransaction(async tx => {
            const [all, config] = await Promise.all([tx.get(root(uid).collection('schedules')), tx.get(root(uid))]);
            const old = all.docs.find(d => d.id === ref.id)?.data();
            if (value.id && !old) throw new Error("일정을 찾을 수 없습니다. 새로고침해주세요.");
            if (old && value.version !== old.version) throw new Error("다른 화면에서 수정됐습니다. 새로고침 후 다시 시도해주세요.");
            if (!old && all.size >= 200) throw new Error("반복 일정은 최대 200개까지 등록할 수 있습니다.");
            const schedule: RecurringSchedule = { id: ref.id, name: value.name.trim(), icon: value.icon, category: value.category,
                kind: value.kind, month: value.kind === 'monthly' ? 1 : value.month, day: value.day,
                time: value.time, duration: value.duration, enabled: value.enabled, calendar: value.calendar, leapMonth: value.calendar === 'lunar' && value.leapMonth === true,
                startDate: old?.startDate || koreaDate(), version: (old?.version || 0) + 1 };
            const conflict = all.docs.find(d => scheduleConflict(schedule, { ...d.data(), id: d.id } as RecurringSchedule));
            if (conflict) throw new Error("같은 반복 유형 안에서 일정이 겹칩니다: " + conflict.data().name);
            tx.set(ref, { ...schedule, updatedAt: FieldValue.serverTimestamp() });
            tx.set(root(uid), { revision: (config.data()?.revision || 0) + 1 }, { merge: true });
        });
    }
    async function remove(uid: string, id: string, version: number) {
        const ref = root(uid).collection('schedules').doc(id);
        await db.runTransaction(async tx => {
            const [row, config] = await Promise.all([tx.get(ref), tx.get(root(uid))]);
            if (!row.exists || row.data()?.version !== version) throw new Error("일정이 변경됐습니다. 새로고침해주세요.");
            tx.delete(ref);
            tx.set(root(uid), { revision: (config.data()?.revision || 0) + 1 }, { merge: true });
        });
    }
    async function enable(uid: string, enabled: boolean) {
        if (!enabled) { await root(uid).set({ enabled: false }, { merge: true }); return; }
        const c = await connection(uid, true);
        await root(uid).set({ enabled: true, sourceId: c.sourceId, activatedDate: koreaDate(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    async function syncUser(uid: string, manual = false) {
        const config = (await root(uid).get()).data();
        if (!config?.enabled) {
            if (manual) throw new Error('RECURRING_AUTOMATION_DISABLED');
            return;
        }
        const result = { created: 0, updated: 0, existing: 0, review: 0, skipped: 0 };
        const schedules = await root(uid).collection('schedules').get();
        const today = koreaDate();
        // First version only produces today's occurrences; no silent historical backfill.
        const due = schedules.docs.map(d => ({ ...d.data(), id: d.id } as RecurringSchedule)).filter(s => isScheduleDue(s, today));
        if (!due.length && !manual) return result;
        const c = await connection(uid, manual);
        if (manual) {
            await deps.assertConnection(uid, c.token, c.connectionId);
            await root(uid).set({ sourceId: c.sourceId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else if (c.sourceId !== config?.sourceId) throw new Error("할일 DB 연결이 변경됐습니다. 수동 동기화를 실행해주세요.");
        if (!due.length) return result;
        for (const schedule of due) {
            const ref = root(uid).collection('occurrences').doc(occurrenceKey(schedule.id, today));
            const token = randomUUID();
            const claim = await db.runTransaction(async tx => {
                const [receipt, current, settings] = await Promise.all([tx.get(ref), tx.get(root(uid).collection('schedules').doc(schedule.id)), tx.get(root(uid))]);
                const previous = receipt.data();
                if (!settings.data()?.enabled || settings.data()?.sourceId !== c.sourceId || current.data()?.version !== schedule.version || !current.data()?.enabled) return null;
                if (previous?.leaseUntil > Date.now()) return null;
                const sameSource = previous?.sourceId === c.sourceId;
                tx.set(ref, { name: schedule.name, date: today, sourceId: c.sourceId, token, leaseUntil: Date.now() + 180000,
                    attempted: sameSource && previous?.attempted === true,
                    pageId: sameSource ? previous?.pageId || '' : '',
                    syncedVersion: sameSource ? previous?.syncedVersion || 0 : 0,
                    status: 'checking', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                return { attempted: sameSource && previous?.attempted === true, pageId: sameSource ? previous?.pageId : '', syncedVersion: sameSource ? previous?.syncedVersion : 0 };
            });
            if (!claim) { result.skipped++; continue; }
            const finish = async (values: object) => db.runTransaction(async tx => {
                const receipt = await tx.get(ref);
                if (receipt.data()?.token === token) tx.set(ref, { ...values, leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            });
            let creating = false;
            try {
                // A failed lookup is not proof of deletion. A 404 can also mean lost permissions.
                let knownPage: any;
                let confirmedDeleted = false;
                if (claim.pageId) {
                    knownPage = await c.notion.pages.retrieve({ page_id: claim.pageId });
                    const parentId = knownPage.parent?.data_source_id || knownPage.parent?.database_id;
                    if (parentId !== c.sourceId) throw new Error("기존 할일이 다른 DB로 이동했습니다. 확인이 필요합니다.");
                    confirmedDeleted = !!(knownPage.in_trash || knownPage.archived);
                    if (!confirmedDeleted && knownPage.properties?.[KEY]?.rich_text?.map((part: any) => part.plain_text ?? part.text?.content ?? '').join('') !== ref.id) throw new Error("기존 할일의 자동생성 키가 변경되었습니다. 확인이 필요합니다.");
                }
                const found = await c.notion.dataSources.query({ data_source_id: c.sourceId, filter: { property: KEY, rich_text: { equals: ref.id } } });
                const candidates = new Set(found.results.filter((page: any) => !page.in_trash && !page.archived).map(page => page.id));
                if (knownPage && !confirmedDeleted) candidates.add(knownPage.id);
                if (candidates.size > 1) throw new Error("같은 자동생성 키의 할일이 여러 개입니다. 확인이 필요합니다.");
                let pageId = [...candidates][0];
                if (!pageId && claim.attempted && !confirmedDeleted) {
                    await finish({ status: 'review' }); result.review++;
                    continue;
                }
                const properties = {
                    '할일': { title: [{ text: { content: ((schedule.calendar === 'lunar' ? '(음) ' : '') + schedule.icon + ' ' + schedule.name).trim() } }] },
                    '날짜': { date: schedule.time ? {
                        start: today + 'T' + schedule.time + ':00+09:00',
                        end: new Date(Date.parse(today + 'T' + schedule.time + ':00+09:00') + schedule.duration * 60000).toISOString()
                    } : { start: today } },
                    [KEY]: { rich_text: [{ text: { content: ref.id } }] }
                };
                if (!pageId || claim.syncedVersion !== schedule.version) {
                    await deps.assertConnection(uid, c.token, c.connectionId);
                    const proceed = await db.runTransaction(async tx => {
                        const [receipt, row, settings] = await Promise.all([tx.get(ref), tx.get(root(uid).collection('schedules').doc(schedule.id)), tx.get(root(uid))]);
                        if (receipt.data()?.token !== token || row.data()?.version !== schedule.version || !row.data()?.enabled || !settings.data()?.enabled || settings.data()?.sourceId !== c.sourceId) return false;
                        tx.set(ref, { attempted: true, pageId: pageId || '', status: pageId ? 'updating' : 'creating', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                        return true;
                    });
                    if (!proceed) { await finish({ status: 'cancelled' }); result.skipped++; continue; }
                    if (pageId) {
                        await c.notion.pages.update({ page_id: pageId, properties }); result.updated++;
                    } else {
                        creating = true;
                        const page = await c.notion.pages.create({ parent: { data_source_id: c.sourceId }, properties: {
                            ...properties, '유형': { status: { name: '할 것' } }, '분류': { select: { name: '일정' } }
                        }, template: { type: 'default' } });
                        pageId = page.id; result.created++;
                    }
                } else result.existing++;
                await finish({ status: 'created', pageId, syncedVersion: schedule.version });
            } catch (error) {
                // Explicit API rejection proves no page was created; a timeout or 5xx does not.
                const rejected = creating && ['validation_error', 'unauthorized', 'restricted_resource', 'object_not_found', 'rate_limited'].includes((error as { code?: string })?.code || '');
                await finish({ status: 'review', ...(rejected ? { attempted: false } : {}) }); result.review++;
                console.error('[RecurringSchedules] occurrence failed', { userId: uid, occurrence: ref.id, error: String(error) });
            }
        }
        return result;
    }
    async function processUser(uid: string, manual = false) {
        if (!(await root(uid).get()).data()?.enabled) {
            if (manual) throw new Error('RECURRING_AUTOMATION_DISABLED');
            return;
        }
        const trigger = manual ? '수동' : '자동';
        const record = async (event: Parameters<NonNullable<Dependencies['writeEvent']>>[1]) => {
            try { await deps.writeEvent?.(uid, event); }
            catch (error) { console.error('[RecurringSchedules] event log failed', { userId: uid, error: String(error) }); }
        };
        await record({ status: 'running', eventTitle: '반복 일정 동기화 시작', description: `실행 방식: ${trigger}\n대상 날짜: ${koreaDate()}` });
        try {
            const result = await syncUser(uid, manual);
            if (!result) {
                await record({ status: 'completed', eventTitle: '반복 일정 동기화 중지', description: '사용 여부가 꺼져 실행을 중지했습니다.' });
                return;
            }
            await record({ status: result.review ? 'failed' : 'completed', eventTitle: result.review ? '반복 일정 동기화 확인 필요' : '반복 일정 동기화 완료',
                description: `실행 방식: ${trigger}\n대상 날짜: ${koreaDate()}\n생성: ${result.created}\n수정: ${result.updated}\n기존 확인: ${result.existing}\n확인 필요: ${result.review}\n처리 보류: ${result.skipped}`,
                targetData: { trigger, date: koreaDate(), ...result } });
            return result;
        } catch (error) {
            await record({ status: 'failed', eventTitle: '반복 일정 동기화 실패', description: `실행 방식: ${trigger}\n오류: ${error instanceof Error ? error.message : String(error)}` });
            throw error;
        }
    }
    return { state, save, remove, enable, processUser };
}
