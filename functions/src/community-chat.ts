import {createHash} from 'crypto';
import {firestore} from 'firebase-admin';
import {isCommunityWithdrawn} from './community-withdrawal';

type Identity = {uid: string; isAdmin?: boolean};
type Input = Record<string, unknown>;
type Fail = (status: number, message: string) => never;

/** All message content goes through authenticated server checks; realtime signals carry no content. */
export function createCommunityChat(db: firestore.Firestore, now: () => number, fail: Fail) {
    const chats = db.collection('communityChats');
    const members = db.collection('communityMembers');
    const privateMembers = db.collection('communityMemberPrivate');
    const inbox = (uid: string) => privateMembers.doc(uid).collection('chats');
    const validId = (value: unknown) => {
        if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) fail(400, '대화 정보를 확인해주세요.');
        return value;
    };
    const active = (d: firestore.DocumentSnapshot) => d.exists && d.get('active') === true && d.get('blocked') !== true && !isCommunityWithdrawn(d.data());
    const profile = (d: firestore.DocumentSnapshot) => ({id: d.id, name: d.get('name') || '멤버', avatar: d.get('avatar') || ''});
    function signal(tx: firestore.Transaction, uids: string[], stamp: number) {
        for (const uid of uids) tx.set(db.collection('communityChatSignals').doc(uid), {updatedAt: stamp, revision: firestore.FieldValue.increment(1)}, {merge: true});
    }
    async function participants(who: Identity, chatId: string, tx?: firestore.Transaction) {
        const ref = chats.doc(chatId), chat = tx ? await tx.get(ref) : await ref.get();
        const ids: string[] = chat.get('participants') || [];
        if (!chat.exists || ids.length !== 2 || !ids.includes(who.uid)) fail(404, '대화를 찾을 수 없습니다.');
        const refs = ids.map(uid => members.doc(uid));
        const people = tx ? await tx.getAll(...refs) : await db.getAll(...refs);
        if (people.some(p => !active(p))) fail(403, '현재 대화할 수 없는 멤버입니다.');
        return {ref, chat, ids, peer: people.find(p => p.id !== who.uid)!};
    }
    async function page(query: firestore.Query, value: unknown, size: number, field: string) {
        let q = query.orderBy(field, 'desc').orderBy(firestore.FieldPath.documentId(), 'desc');
        if (value != null) {
            if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0) fail(400, '목록 위치를 확인해주세요.');
            q = q.startAfter(value[0], validId(value[1]));
        }
        const result = await q.limit(size + 1).get(), docs = result.docs.slice(0, size), last = docs[docs.length - 1];
        return {docs, nextCursor: result.size > size ? [last.get(field), last.id] : null};
    }
    return async (who: Identity, input: Input, adminIds: Set<string> = new Set()) => {
        async function canReceive(peerId: string, tx: firestore.Transaction) {
            const settings = await tx.get(privateMembers.doc(peerId));
            if (!who.isAdmin && !adminIds.has(peerId) && settings.get('allowMemberDm') !== true) fail(403, '상대방이 멤버 DM 수신을 허용하지 않았습니다.');
        }
        if (!who.uid || !active(await members.doc(who.uid).get())) fail(403, '클럽 멤버만 채팅할 수 있습니다.');
        if (input.action === 'chatInbox') {
            const result = await page(inbox(who.uid), input.cursor, 30, 'updatedAt');
            const peers = result.docs.length ? await db.getAll(...result.docs.map(d => members.doc(d.get('peerId')))) : [];
            const unread = await inbox(who.uid).where('unread', '==', true).limit(30).get();
            const unreadPeers = unread.empty ? [] : await db.getAll(...unread.docs.map(d => members.doc(d.get('peerId'))));
            return {items: result.docs.filter((_, i) => active(peers[i])).map(d => {
                const peer = peers.find(p => p.id === d.get('peerId'))!;
                return {id: d.id, peer: profile(peer), preview: d.get('preview') || '', updatedAt: d.get('updatedAt'), unread: d.get('unread') === true};
            }), nextCursor: result.nextCursor, hasUnread: unreadPeers.some(active)};
        }
        if (input.action === 'chatStart') {
            const peerId = validId(input.peerId);
            if (peerId === who.uid) fail(400, '다른 멤버를 선택해주세요.');
            const ids = [who.uid, peerId].sort();
            const chatId = createHash('sha256').update(JSON.stringify(ids)).digest('hex');
            await db.runTransaction(async tx => {
                const [me, peer, chat] = await tx.getAll(members.doc(who.uid), members.doc(peerId), chats.doc(chatId));
                if (!active(me) || !active(peer)) fail(403, '현재 대화할 수 없는 멤버입니다.');
                await canReceive(peerId, tx);
                if (!chat.exists) tx.create(chats.doc(chatId), {participants: ids, blockedBy: [], createdAt: now(), lastMessageAt: 0});
            });
            return {chatId};
        }
        const chatId = validId(input.chatId);
        if (input.action === 'chatMessages') {
            const ctx = await participants(who, chatId);
            const result = await page(ctx.ref.collection('messages'), input.cursor, 40, 'createdAt');
            return {peer: profile(ctx.peer), blocked: (ctx.chat.get('blockedBy') || []).length > 0,
                blockedByMe: (ctx.chat.get('blockedBy') || []).includes(who.uid),
                messages: result.docs.map(d => ({id: d.id, authorId: d.get('authorId'), body: d.get('deleted') ? '' : d.get('body'), deleted: !!d.get('deleted'), createdAt: d.get('createdAt')})), nextCursor: result.nextCursor};
        }
        if (input.action === 'chatSend') {
            const messageId = validId(input.messageId);
            if (typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 4000) fail(400, '메시지는 1~4,000자로 입력해주세요.');
            const body = input.body.trim();
            await db.runTransaction(async tx => {
                const ctx = await participants(who, chatId, tx);
                const messageRef = ctx.ref.collection('messages').doc(messageId);
                const [existing, throttle] = await tx.getAll(messageRef, privateMembers.doc(who.uid));
                if (existing.exists) {
                    if (existing.get('authorId') !== who.uid || existing.get('body') !== body || existing.get('deleted')) fail(409, '다른 메시지와 중복되었습니다. 다시 시도해주세요.');
                    return;
                }
                if ((ctx.chat.get('blockedBy') || []).length) fail(403, '메시지를 보낼 수 없는 대화입니다.');
                await canReceive(ctx.peer.id, tx);
                if (now() - (throttle.get('lastChatAt') || 0) < 1000) fail(429, '잠시 후 다시 보내주세요.');
                const stamp = Math.max(now(), (ctx.chat.get('lastMessageAt') || 0) + 1);
                tx.create(messageRef, {authorId: who.uid, body, createdAt: stamp, deleted: false});
                tx.update(ctx.ref, {lastMessageAt: stamp, lastMessageId: messageId});
                tx.set(privateMembers.doc(who.uid), {lastChatAt: now()}, {merge: true});
                for (const uid of ctx.ids) tx.set(inbox(uid).doc(chatId), {peerId: ctx.ids.find(id => id !== uid), preview: body.slice(0, 100), updatedAt: stamp, unread: uid !== who.uid}, {merge: true});
                signal(tx, ctx.ids, stamp);
            });
            return {ok: true};
        }
        if (input.action === 'chatRead') {
            if (!Number.isSafeInteger(input.readAt) || Number(input.readAt) < 0) fail(400, '읽음 위치를 확인해주세요.');
            await db.runTransaction(async tx => {
                const ctx = await participants(who, chatId, tx);
                const row = await tx.get(inbox(who.uid).doc(chatId));
                if (row.exists && row.get('unread') && Number(input.readAt) >= ctx.chat.get('lastMessageAt')) {
                    tx.update(row.ref, {unread: false}); signal(tx, [who.uid], now());
                }
            });
            return {ok: true};
        }
        if (input.action === 'chatBlock') {
            if (typeof input.blocked !== 'boolean') fail(400, '차단 설정을 확인해주세요.');
            await db.runTransaction(async tx => {
                const ctx = await participants(who, chatId, tx);
                const blocked = new Set<string>(ctx.chat.get('blockedBy') || []);
                if (input.blocked) blocked.add(who.uid); else blocked.delete(who.uid);
                tx.update(ctx.ref, {blockedBy: [...blocked]}); signal(tx, ctx.ids, now());
            });
            return {ok: true};
        }
        if (input.action === 'chatDelete') {
            const messageId = validId(input.messageId);
            await db.runTransaction(async tx => {
                const ctx = await participants(who, chatId, tx);
                const ref = ctx.ref.collection('messages').doc(messageId), message = await tx.get(ref);
                if (!message.exists || message.get('authorId') !== who.uid) fail(403, '본인 메시지만 삭제할 수 있습니다.');
                tx.update(ref, {body: '', deleted: true});
                if (ctx.chat.get('lastMessageId') === messageId) for (const uid of ctx.ids) tx.set(inbox(uid).doc(chatId), {preview: '삭제된 메시지입니다.'}, {merge: true});
                signal(tx, ctx.ids, now());
            });
            return {ok: true};
        }
        fail(400, '지원하지 않는 채팅 요청입니다.');
    };
}
