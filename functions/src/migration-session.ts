import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { MigrationConflict } from './lifeup-migration-runner';

export type MigrationMode = 'migration' | 'templateTransfer';
export type SessionAction = 'connect' | 'callback' | 'check' | 'run' | 'stop' | 'disconnect';
const otherMode = (mode: MigrationMode): MigrationMode => mode === 'migration' ? 'templateTransfer' : 'migration';
const tokenField = (mode: MigrationMode) => mode === 'migration' ? 'notionMigrationAccessToken' : 'notionTemplateTransferAccessToken';
export const sessionConflict = (mode: MigrationMode) => new MigrationConflict(
    `${mode === 'migration' ? '1.3 → 1.5 업데이트' : '개별 1.5 템플릿 이전'} 연결이 사용 중입니다. 해당 화면에서 연결을 해제한 뒤 진행해주세요.`
);

// The session persists until explicit disconnect. Only the request lease expires,
// after the maximum Cloud Function lifetime (plus a safety margin), never on reload.
export async function claimMigrationSession(
    db: admin.firestore.Firestore, userId: string, mode: MigrationMode,
    action: SessionAction, expectedSession?: string
) {
    const userRef = db.collection('users').doc(userId);
    const ref = userRef.collection('integrations').doc('migrationSession');
    const operationId = randomUUID();
    return db.runTransaction(async tx => {
        const user = (await tx.get(userRef)).data();
        const lock = (await tx.get(ref)).data();
        if (!user) throw new MigrationConflict('사용자 정보를 찾을 수 없습니다.');
        if (expectedSession && (!lock || lock.sessionId !== expectedSession || lock.mode !== mode)) {
            throw new MigrationConflict('취소되었거나 만료된 연결입니다. 다시 연결해주세요.');
        }
        // Disconnect may clean up a pre-deployment second connection, but must
        // never release the other mode's session or overlap its worker.
        if (action !== 'disconnect') {
            if (lock && lock.mode !== mode) throw sessionConflict(lock.mode);
            if (user[tokenField(otherMode(mode))]) throw sessionConflict(otherMode(mode));
        }
        if (action === 'stop') {
            if (lock?.operationId && lock.busyUntil > Date.now() && lock.action !== 'run') {
                throw new MigrationConflict('연결 또는 점검 작업이 진행 중입니다. 완료 후 다시 시도해주세요.');
            }
            if (lock?.stopOperationId && lock.stopBusyUntil > Date.now()) throw new MigrationConflict('중단 요청을 처리 중입니다.');
            const sessionId = lock?.sessionId || randomUUID();
            tx.set(ref, { ...lock, mode, sessionId, stopOperationId: operationId, stopBusyUntil: Date.now() + 3720000 });
            return { ref, sessionId, operationId, mode, releaseSession: false, isStop: true };
        }
        if (lock?.awaitingOAuth && ['check', 'run'].includes(action)) {
            throw new MigrationConflict('노션 연결을 진행 중입니다. 연결을 완료하거나 취소한 뒤 진행해주세요.');
        }
        if (lock?.operationId && lock.busyUntil > Date.now()) {
            throw new MigrationConflict('서버에서 연결 또는 이전 작업을 처리 중입니다. 작업이 끝난 뒤 다시 시도해주세요.');
        }
        if (lock?.stopOperationId && lock.stopBusyUntil > Date.now()) throw new MigrationConflict('중단 요청을 처리 중입니다. 완료 후 다시 시도해주세요.');
        // Adopt connections created before the shared lock was deployed. Existing
        // workers must finish before reconnect/check/disconnect can change state.
        for (const parentId of lock?.action ? [] : ['migration', 'templateTransfer']) {
            const parent = userRef.collection('integrations').doc(parentId);
            const state = (await tx.get(parent)).data();
            for (const [field, collection, statuses, duration] of [
                ['migrationRunId', 'migration', ['migrating', 'stopping'], 3720000],
                ['migrationCheckRunId', 'migrationCheck', ['checking'], 660000]
            ] as const) {
                if (!state?.[field]) continue;
                const run = (await tx.get(parent.collection(collection).doc(state[field]))).data();
                const started = run?.updatedAt?.toMillis?.() || run?.startedAt?.toMillis?.() || run?.createdAt?.toMillis?.() || 0;
                if (run && (statuses as readonly string[]).includes(run.status) && started + duration > Date.now()) {
                    throw new MigrationConflict('실행 중인 이전/점검 작업이 있습니다. 종료된 뒤 연결을 변경해주세요.');
                }
            }
        }
        const sessionId = action === 'connect' ? randomUUID() : lock?.sessionId || randomUUID();
        const ownerMode = lock?.mode || mode;
        tx.set(ref, {
            mode: ownerMode, sessionId, operationId, action,
            awaitingOAuth: action === 'connect' || !!lock?.awaitingOAuth,
            busyUntil: Date.now() + (action === 'run' ? 3720000 : action === 'check' ? 660000 : 480000)
        });
        return { ref, sessionId, operationId, mode, releaseSession: ownerMode === mode, isStop: false };
    });
}

export async function finishMigrationSession(
    db: admin.firestore.Firestore,
    claim: Awaited<ReturnType<typeof claimMigrationSession>>,
    disconnected = false,
    connected = false
) {
    if (!claim.operationId) return;
    await db.runTransaction(async tx => {
        const lock = (await tx.get(claim.ref)).data();
        if (claim.isStop) {
            if (lock?.stopOperationId === claim.operationId) tx.update(claim.ref, { stopOperationId: null, stopBusyUntil: 0 });
            return;
        }
        if (lock?.operationId !== claim.operationId) return;
        if (disconnected && claim.releaseSession) tx.delete(claim.ref);
        else tx.update(claim.ref, { operationId: null, busyUntil: 0, ...(connected ? { awaitingOAuth: false } : {}) });
    });
}

// Status polling may overlap a worker, but a late response cannot resurrect a
// disconnected connection or overwrite a newly connected session.
export async function markMigrationConnected(db: admin.firestore.Firestore, userId: string, mode: MigrationMode, token: string) {
    const ref = db.collection('users').doc(userId);
    await db.runTransaction(async tx => {
        const user = (await tx.get(ref)).data();
        const lock = (await tx.get(ref.collection('integrations').doc('migrationSession'))).data();
        if (user?.[tokenField(mode)] !== token || (lock && (lock.mode !== mode || lock.awaitingOAuth || ['connect', 'callback', 'disconnect'].includes(lock.action) && lock.operationId))) {
            throw new MigrationConflict('연결 상태가 변경되었습니다. 새로고침해주세요.');
        }
        const prefix = mode === 'migration' ? 'notionMigration' : 'notionTemplateTransfer';
        if (user?.[`${prefix}ConnectionStatus`] === 'connected') return;
        tx.update(ref, {
            [`${prefix}ConnectionStatus`]: 'connected',
            [`${prefix}ConnectedAt`]: admin.firestore.FieldValue.serverTimestamp(),
            [`${prefix}ConnectionId`]: randomUUID()
        });
    });
}
