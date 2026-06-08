
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AuthBridgeService {

    private readonly PARENT_ORIGIN = 'https://notionable.net';

    async init(): Promise<void> {

        return new Promise((resolve) => {

            const timeout = setTimeout(() => {
                resolve();
            }, 3000);

            const handler = (event: MessageEvent) => {

                if (event.origin !== this.PARENT_ORIGIN) {
                    return;
                }

                if (event.data?.type === 'AUTH') {

                    localStorage.setItem(
                        'auth_token',
                        event.data.token
                    );

                    window.removeEventListener(
                        'message',
                        handler
                    );

                    clearTimeout(timeout);

                    resolve();
                }
            };

            window.addEventListener(
                'message',
                handler
            );

            window.parent.postMessage(
                {
                    type: 'CHECK_AUTH'
                },
                this.PARENT_ORIGIN
            );
        });
    }
}