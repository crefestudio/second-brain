import { firestore } from 'firebase-admin';
import { createHash } from 'crypto';

// Shared by SDK and REST calls, including separate function instances.
export function createNotionRequestControl(db: firestore.Firestore, transport: typeof fetch = globalThis.fetch,
    now = () => Date.now(), sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
    return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.startsWith('https://api.notion.com/')) return transport(input, init);
        const headers = new Headers(init?.headers || (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
        const authorization = headers.get('authorization') || '';
        if (!authorization) return transport(input, init);
        const ref = db.collection('notionRequestLimits').doc(createHash('sha256').update(authorization).digest('hex'));
        const deadline = now() + 120000;
        for (let attempt = 0; attempt < 5; attempt++) {
            for (;;) {
                const delay = await db.runTransaction(async tx => {
                    const state = (await tx.get(ref)).data() || {};
                    const remaining = Math.max(state.nextAt || 0, state.blockedUntil || 0) - now();
                    if (remaining > 0) return remaining;
                    tx.set(ref, { nextAt: now() + 650 }, { merge: true });
                    return 0;
                });
                if (!delay) break;
                if (now() + delay > deadline) throw Object.assign(new Error('NOTION_RATE_WAIT'), { code: 'NOTION_RATE_WAIT' });
                await sleep(Math.min(delay, 10000));
            }
            const response = await transport(input, init);
            if (response.status !== 429 && response.status !== 529) return response;
            const seconds = Number(response.headers.get('retry-after'));
            const pause = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Math.min(60000, 1000 * 2 ** attempt);
            await db.runTransaction(async tx => {
                const state = (await tx.get(ref)).data() || {};
                tx.set(ref, { blockedUntil: Math.max(state.blockedUntil || 0, now() + pause) }, { merge: true });
            });
            if (attempt === 4 || now() + pause > deadline) return response;
            await response.body?.cancel();
        }
        throw new Error('NOTION_RATE_WAIT');
    };
}
