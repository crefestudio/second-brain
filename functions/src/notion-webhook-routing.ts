import { firestore } from 'firebase-admin';
import { createHash } from 'crypto';
type Firestore = firestore.Firestore;
type DocumentData = firestore.DocumentData;
type DocumentReference = firestore.DocumentReference;
const FieldValue = firestore.FieldValue;

export function notionRoutingId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const id = value.replace(/-/g, '').toLowerCase();
    return /^[a-f0-9]{32}$/.test(id) ? id : null;
}

export function webhookRoutingKeys(event: DocumentData): string[] {
    const parent = event.data?.parent;
    const parents = [parent?.database_id, parent?.data_source_id, parent?.id].map(notionRoutingId).filter(Boolean);
    const page = notionRoutingId(event.entity?.id);
    return [...new Set([...parents.map(id => `parent_${id}`), ...(page ? [`page_${page}`] : [])])];
}

export function deferredWebhookStatus(error: unknown): 'waiting_mapping' | 'needs_attention' | null {
    const message = (error as { message?: unknown })?.message;
    const code = typeof message === 'string' ? message : '';
    if (['NO_MATCHING_WORKSPACE', 'NOTION_CONNECTION_CHANGED'].includes(code)) return 'waiting_mapping';
    if (['AMBIGUOUS_WEBHOOK_WORKSPACE', 'INVALID_WEBHOOK_IDS'].includes(code)) return 'needs_attention';
    // Preserve the event for review; a missing/forbidden page is never deleted.
    if ([401, 403, 404].includes(Number((error as { status?: unknown })?.status))) return 'needs_attention';
    return null;
}

function usable(user: DocumentData, config: DocumentData): boolean {
    return !!user.notionAccessToken && user.deletionStatus !== 'archived' &&
        !['pending', 'failed', 'disconnected'].includes(user.notionConnection?.status) &&
        config.accessToken === user.notionAccessToken &&
        !['pending', 'failed', 'disconnected'].includes(config.connectionStatus) &&
        (!config.connectionId || config.connectionId === user.notionConnectionId);
}

// Include credentials in the comparison, never in the routing documents or logs.
export function routingConnectionVersion(user: DocumentData, config: DocumentData): string {
    return JSON.stringify([user.notionAccessToken, user.notionConnectionId, user.deletionStatus,
        user.notionConnection?.status, user.notionConnection?.databases, config.accessToken, config.connectionId,
        config.connectionStatus, config.noteDatabaseId]);
}

type Owner = { connectionId: string | null; noteDatabaseId: string | null };
type RoutingMatch = { userId: string; accessToken: string; connectionId: string | null };

export function createNotionWebhookRouting(db: Firestore, dataSources: (token: string, databaseId: string) => Promise<string[]>) {
    const routes = db.collection('notionWebhookRoutes');
    const states = db.collection('notionWebhookRouteOwners');
    const userRef = (uid: string) => db.collection('users').doc(uid);
    const configRef = (uid: string) => userRef(uid).collection('integrations').doc('secondbrain');

    async function syncConnection(uid: string): Promise<{ keys: string[]; connected: boolean }> {
        const [u, c] = await Promise.all([userRef(uid).get(), configRef(uid).get()]);
        const user = u.data() || {}, config = c.data() || {};
        const version = routingConnectionVersion(user, config);
        const connected = usable(user, config) && !!notionRoutingId(config.noteDatabaseId);
        const databases: string[] = connected ? [...new Set([config.noteDatabaseId,
            ...Object.values(user.notionConnection?.databases || {}).filter(value => notionRoutingId(value))] as string[])] : [];
        const ids: string[] = [];
        for (const databaseId of databases) {
            ids.push(databaseId);
            try { ids.push(...await dataSources(user.notionAccessToken, databaseId)); }
            catch (error) {
                // Retain the known DB alias and cached pages when one old DB was
                // removed. New source aliases cannot be guessed from a 404.
                if (Number((error as { status?: unknown })?.status) !== 404) throw error;
            }
        }
        const keys = [...new Set(ids.map(notionRoutingId).filter(Boolean).map(id => `parent_${id}`))];
        await db.runTransaction(async tx => {
            const [currentUser, currentConfig, previous] = await Promise.all([
                tx.get(userRef(uid)), tx.get(configRef(uid)), tx.get(states.doc(uid))
            ]);
            if (routingConnectionVersion(currentUser.data() || {}, currentConfig.data() || {}) !== version) throw new Error('NOTION_CONNECTION_CHANGED');
            const oldKeys: string[] = previous.data()?.keys || [];
            const allKeys = [...new Set([...oldKeys, ...keys])];
            const snapshots = await Promise.all(allKeys.map(key => tx.get(routes.doc(key))));
            for (let i = 0; i < allKeys.length; i++) {
                const owners = { ...(snapshots[i].data()?.owners || {}) };
                if (keys.includes(allKeys[i])) owners[uid] = { connectionId: user.notionConnectionId || null, noteDatabaseId: notionRoutingId(config.noteDatabaseId) };
                else delete owners[uid];
                if (JSON.stringify(owners) !== JSON.stringify(snapshots[i].data()?.owners || {})) {
                    tx.set(routes.doc(allKeys[i]), { owners, updatedAt: FieldValue.serverTimestamp() });
                }
            }
            tx.set(states.doc(uid), { keys, connectionId: user.notionConnectionId || null, indexStatus: connected ? 'ready' : 'disconnected', updatedAt: FieldValue.serverTimestamp() });
        });
        return { keys, connected };
    }

    // A page index survives moves/deletes. Reconnection invalidates it through
    // connectionId; new observations explicitly bind it to the new connection.
    async function syncPage(uid: string, pageId: string, backfillLegacy = false): Promise<boolean> {
        const id = notionRoutingId(pageId);
        if (!id) return false;
        const ref = routes.doc(`page_${id}`);
        return db.runTransaction(async tx => {
            const [u, c, p, r] = await Promise.all([tx.get(userRef(uid)), tx.get(configRef(uid)),
                tx.get(configRef(uid).collection('pages').doc(pageId)), tx.get(ref)]);
            const user = u.data() || {}, config = c.data() || {}, page = p.data() || {};
            const owners = { ...(r.data()?.owners || {}) };
            const hasVersion = Object.prototype.hasOwnProperty.call(page, 'routingConnectionId');
            const valid = p.exists && usable(user, config) &&
                (hasVersion ? page.routingConnectionId === (user.notionConnectionId || null) : backfillLegacy);
            if (valid) owners[uid] = { connectionId: user.notionConnectionId || null, noteDatabaseId: notionRoutingId(config.noteDatabaseId) };
            else delete owners[uid];
            if (JSON.stringify(owners) !== JSON.stringify(r.data()?.owners || {})) {
                tx.set(ref, { owners, updatedAt: FieldValue.serverTimestamp() });
            }
            return valid;
        });
    }

    async function resolve(event: DocumentData): Promise<RoutingMatch> {
        const keys = webhookRoutingKeys(event);
        if (!notionRoutingId(event.entity?.id)) throw new Error('INVALID_WEBHOOK_IDS');
        const snapshots = await Promise.all(keys.map(key => routes.doc(key).get()));
        const candidates = new Map<string, Owner[]>();
        snapshots.forEach(snapshot => Object.entries(snapshot.data()?.owners || {}).forEach(([uid, owner]) => {
            candidates.set(uid, [...(candidates.get(uid) || []), owner as Owner]);
        }));
        // Never turn a corrupt/shared index into an unbounded scan or guess owner.
        if (candidates.size > 10) throw new Error('AMBIGUOUS_WEBHOOK_WORKSPACE');
        const matches: RoutingMatch[] = [];
        for (const [uid, owners] of candidates) {
            const [u, c] = await Promise.all([userRef(uid).get(), configRef(uid).get()]);
            const user = u.data() || {}, config = c.data() || {};
            if (!usable(user, config)) continue;
            if (!owners.some(owner => owner.connectionId === (user.notionConnectionId || null) &&
                owner.noteDatabaseId === notionRoutingId(config.noteDatabaseId))) continue;
            matches.push({ userId: uid, accessToken: user.notionAccessToken, connectionId: user.notionConnectionId || null });
        }
        if (matches.length > 1) throw new Error('AMBIGUOUS_WEBHOOK_WORKSPACE');
        if (!matches.length) throw new Error('NO_MATCHING_WORKSPACE');
        return matches[0];
    }
    async function requeueWaiting(ref: DocumentReference): Promise<boolean> {
        const item = (await ref.get()).data();
        if (item?.status !== 'waiting_mapping' || !item.event || (item.routingReplayDepth || 0) >= 3) return false;
        let match: RoutingMatch;
        try { match = await resolve(item.event); }
        catch (error) { if (deferredWebhookStatus(error)) return false; throw error; }
        const id = createHash('sha256').update(`routing-replay:${ref.id}:${match.userId}:${match.connectionId}`).digest('hex');
        const next = db.collection('notionWebhookInbox').doc(id);
        return db.runTransaction(async tx => {
            const [current, existing, u, c] = await Promise.all([tx.get(ref), tx.get(next), tx.get(userRef(match.userId)), tx.get(configRef(match.userId))]);
            if (current.data()?.status !== 'waiting_mapping' || existing.exists ||
                !usable(u.data() || {}, c.data() || {}) || (u.data()?.notionConnectionId || null) !== match.connectionId) return false;
            tx.create(next, { event: current.data()!.event, status: 'pending', attempts: 0,
                routingReplayDepth: (item.routingReplayDepth || 0) + 1, replayOf: ref.id,
                receivedAt: FieldValue.serverTimestamp() });
            tx.update(ref, { status: 'replay_queued', replayId: id, waitingRouteKeys: FieldValue.delete(), replayQueuedAt: FieldValue.serverTimestamp() });
            return true;
        });
    }

    async function replayForRoute(key: string): Promise<number> {
        let count = 0;
        let cursor;
        // Only the deferred queue for this exact ID; never scan users or history.
        for (;;) {
            let query = db.collection('notionWebhookInbox').where('waitingRouteKeys', 'array-contains', key).orderBy('__name__').limit(100);
            if (cursor) query = query.startAfter(cursor);
            const page = await query.get();
            for (const doc of page.docs) if (await requeueWaiting(doc.ref)) count++;
            if (page.size < 100) return count;
            cursor = page.docs[page.docs.length - 1];
        }
    }
    return { syncConnection, syncPage, resolve, requeueWaiting, replayForRoute };
}
