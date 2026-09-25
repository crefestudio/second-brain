import type * as admin from 'firebase-admin';

export async function deleteAccountData(
    db: admin.firestore.Firestore,
    auth: admin.auth.Auth,
    uid: string,
    deleteAttachments: (requestId: string) => Promise<void>,
    removeCustomerEmail: (email: string) => Promise<void>,
    deleteWorkspaceFiles: (workspaceId: string) => Promise<void> = () => Promise.resolve()
): Promise<void> {
    const user = await auth.getUser(uid);
    const accountRef = db.collection('appAccounts').doc(uid);
    // Keep a server-owned manifest until cleanup completes so partial failures can be retried.
    const workspaceIds = await db.runTransaction(async tx => {
        const account = await tx.get(accountRef);
        const owned = await tx.get(db.collection('users').where('firebaseUid', '==', uid));
        const previous = account.data();
        const ids = [...new Set<string>([
            ...(previous?.deletionStatus === 'pending' ? previous.deletionWorkspaceIds || [] : []),
            ...owned.docs.map(doc => doc.id)
        ])];
        tx.set(accountRef, { deletionStatus: 'pending', deletionWorkspaceIds: ids,
            marketingConsent: false, marketingConsentSource: 'user' }, { merge: true });
        return ids;
    });
    if (user.email) await removeCustomerEmail(user.email.trim().toLowerCase());
    for (const id of workspaceIds) {
        const ref = db.collection('users').doc(id);
        const workspace = await ref.get();
        if (workspace.exists && workspace.data()?.firebaseUid !== uid) {
            throw new Error('WORKSPACE_OWNERSHIP_CHANGED');
        }
        // Remove widget credentials and integration tokens before recursive cleanup.
        if (workspace.exists) await ref.set({
            firebaseUid: uid, deletionStatus: 'pending'
        });
        const connections = await db.collection('kakaoConnections').where('userId', '==', id).get();
        for (const connection of connections.docs) await connection.ref.delete();
        await db.collection('kakao_verifications').doc(id).delete();
        await deleteWorkspaceFiles(id);
        await db.recursiveDelete(ref);
    }
    const requests = await db.collection('careRequests').where('ownerId', '==', uid).get();
    for (const request of requests.docs) {
        await deleteAttachments(request.id);
        await db.recursiveDelete(request.ref);
    }
    if (user.email) {
        await db.collection('email_verifications').doc(user.email.trim().toLowerCase()).delete();
    }
    // Keep Auth until application cleanup succeeds, allowing the same member to retry.
    await db.recursiveDelete(accountRef);
    await auth.deleteUser(uid);
}
