import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AuthBridgeService {

    private readonly PARENT_ORIGIN = 'https://notionable.net';

    async init(): Promise<void> {

        return new Promise((resolve) => {

            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve();
            }, 3000);

            const handler = (event: MessageEvent) => {

                if (event.origin !== this.PARENT_ORIGIN) return;
                if (event.data?.type !== 'AUTH') return;

                const memberUid = event.data.memberUid;

                if (memberUid) {
                    localStorage.setItem('member_uid', memberUid);
                } else {
                    localStorage.removeItem('member_uid');
                }

                window.removeEventListener('message', handler);
                clearTimeout(timeout);
                resolve();
            };

            window.addEventListener('message', handler);

            window.parent.postMessage(
                { type: 'CHECK_AUTH' },
                this.PARENT_ORIGIN
            );
        });
    }
}