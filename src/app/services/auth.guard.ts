import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = () => {

    const router = inject(Router);

    if (
        window.location.hostname !==
        'app.notionable.net'
    ) {
        return true;
    }

    const memberUid =
        localStorage.getItem(
            'member_uid'
        )?.trim();

    if (memberUid) {
        return true;
    }

    return router.createUrlTree([
        '/unauthorized'
    ]);
};