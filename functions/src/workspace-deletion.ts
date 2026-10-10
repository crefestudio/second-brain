import type * as admin from 'firebase-admin';

export class WorkspaceDeletionError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

// Soft deletion is one atomic transaction. Descendants remain at their original
// paths for administrative recovery; no root ownership or credentials remain.
export async function archiveWorkspace(db: admin.firestore.Firestore, uid: string, userId: string): Promise<void> {
    const workspaceRef = db.collection('users').doc(userId);
    const archiveRef = db.collection('deletedWorkspaces').doc(userId);
    const accountRef = db.collection('appAccounts').doc(uid);
    await db.runTransaction(async tx => {
        const [workspace, archive, account, owned, connections] = await Promise.all([
            tx.get(workspaceRef), tx.get(archiveRef), tx.get(accountRef),
            tx.get(db.collection('users').where('firebaseUid', '==', uid)),
            tx.get(db.collection('kakaoConnections').where('userId', '==', userId))
        ]);
        if (archive.exists && archive.data()?.ownerUid === uid && workspace.data()?.deletionStatus === 'archived') return;
        if (!workspace.exists || workspace.data()?.firebaseUid !== uid)
            throw new WorkspaceDeletionError(403, '이 워크스페이스를 삭제할 권한이 없습니다.');
        if (account.data()?.deletionStatus === 'pending') throw new WorkspaceDeletionError(409, '회원 탈퇴 처리 중입니다.');
        if (account.data()?.userId !== userId) throw new WorkspaceDeletionError(409, '선택한 워크스페이스가 변경되었습니다. 새로고침 후 다시 확인해주세요.');
        if (archive.exists) throw new WorkspaceDeletionError(409, '보관 기록이 이미 있습니다. 관리자에게 문의해주세요.');
        if (connections.size > 400) throw new WorkspaceDeletionError(409, '연결 정보 확인이 필요합니다. 관리자에게 문의해주세요.');
        const deletedAt = new Date();
        tx.create(archiveRef, { ownerUid: uid, workspaceId: userId, deletedAt, workspace: workspace.data(),
            retention: 'manual', descendantsPath: workspaceRef.path,
            kakaoConnections: connections.docs.map(doc => ({ id: doc.id, data: doc.data() })) });
        // Replace, never merge: remove Firebase ownership, email, Notion token,
        // widget key and Kakao ID so the workspace cannot be selected or reused.
        tx.set(workspaceRef, { deletionStatus: 'archived', deletedAt });
        for (const connection of connections.docs) tx.delete(connection.ref);
        tx.delete(db.collection('kakao_verifications').doc(userId));
        const next = owned.docs.find(doc => doc.id !== userId && doc.data().deletionStatus !== 'archived');
        tx.set(accountRef, { userId: next?.id || '' }, { merge: true });
    });
}
