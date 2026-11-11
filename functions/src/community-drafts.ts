import {firestore} from 'firebase-admin';
import {normalizeDocument, documentText} from './community-document';
import {normalizeCommunityMedia} from './community-media';
import {COMMUNITY_ROOMS, isCommunityRoomVisible, supportsCommunityRequests} from './community-model';
import {isCommunityWithdrawn} from './community-withdrawal';

export function createCommunityDrafts(db: firestore.Firestore, now: () => number, fail: (status: number, message: string) => never) {
    return async (who: {uid: string; isAdmin: boolean}, input: Record<string, unknown>) => {
        const drafts = db.collection('communityMemberPrivate').doc(who.uid).collection('drafts');
        const output = (d: firestore.DocumentSnapshot) => ({...d.data(), id: d.id});
        if (input.action === 'drafts') {
            let query = drafts.orderBy('updatedAt', 'desc').orderBy(firestore.FieldPath.documentId(), 'desc');
            if (input.cursor != null) {
                const c = input.cursor;
                if (!Array.isArray(c) || c.length !== 2 || !Number.isSafeInteger(c[0]) || typeof c[1] !== 'string' || !/^[\w-]{1,100}$/.test(c[1])) fail(400, '목록 위치를 확인해주세요.');
                query = query.startAfter(c[0], c[1]);
            }
            const result = await query.limit(21).get(), docs = result.docs.slice(0, 20), last = docs[docs.length - 1];
            return {drafts: docs.map(output), nextCursor: result.size > 20 ? [last.get('updatedAt'), last.id] : null};
        }
        if (typeof input.draftId !== 'string' || !/^[\w-]{1,100}$/.test(input.draftId)) fail(400, '임시저장 글을 확인해주세요.');
        const ref = drafts.doc(input.draftId as string);
        if (input.action === 'draft') {
            const d = await ref.get();
            if (!d.exists) fail(404, '임시저장 글을 찾을 수 없습니다.');
            return {draft: output(d)};
        }
        if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) fail(400, '저장 버전을 확인해주세요.');
        let data: Record<string, unknown> = {};
        if (input.action === 'saveDraft') {
            const room = COMMUNITY_ROOMS.find(r => r.id === input.roomId && isCommunityRoomVisible(r.id));
            if (!room || room.adminOnly && !who.isAdmin) fail(403, '작성할 수 없는 공간입니다.');
            if (!['feed', 'question', 'request'].includes(String(input.kind)) || input.kind === 'request' && !supportsCommunityRequests(input.roomId)) fail(400, '글 형식을 확인해주세요.');
            if (typeof input.title !== 'string' || input.title.length > 160 || typeof input.body !== 'string' || input.body.length > 12000 || typeof input.isPrivate !== 'boolean') fail(400, '제목과 내용을 확인해주세요.');
            try {
                const bodyDocument = input.bodyDocument == null ? null : normalizeDocument(input.bodyDocument);
                const media = await normalizeCommunityMedia(input.media || []);
                const sharing = input.sharing as {newsletter?: boolean; kakao?: boolean; instagram?: boolean} | undefined;
                data = {roomId: input.roomId, kind: input.kind === 'request' || room!.kind === 'both' ? input.kind : room!.kind, title: input.title, body: bodyDocument ? documentText(bodyDocument) : input.body, bodyDocument, media, isPrivate: input.isPrivate,
                    sharing: {newsletter: who.isAdmin && sharing?.newsletter === true, kakao: who.isAdmin && sharing?.kakao === true, instagram: who.isAdmin && sharing?.instagram === true}};
            } catch (e) { fail(400, (e as Error).message); }
        }
        await db.runTransaction(async tx => {
            const [member, existing, published] = await tx.getAll(db.collection('communityMembers').doc(who.uid), ref, db.collection('communityPosts').doc(ref.id));
            if (!member.exists || member.get('active') !== true || isCommunityWithdrawn(member.data())) fail(403, '클럽에 먼저 가입해주세요.');
            if (published.exists) fail(409, '이미 게시된 글입니다. 게시글 목록에서 확인해주세요.');
            if ((existing.get('revision') || 0) !== input.revision) fail(409, '다른 창에서 수정된 글입니다. 임시저장 목록에서 다시 열어주세요.');
            if (input.action === 'deleteDraft') {
                if (!existing.exists) fail(404, '임시저장 글을 찾을 수 없습니다.');
                tx.delete(ref);
            } else {
                tx.set(ref, {...data, createdAt: existing.get('createdAt') || now(), updatedAt: now(), revision: Number(input.revision) + 1});
            }
        });
        return input.action === 'deleteDraft' ? {ok: true} : {draft: output(await ref.get())};
    };
}
