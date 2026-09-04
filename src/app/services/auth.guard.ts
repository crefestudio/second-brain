import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const memberGuard: CanActivateFn = () => {
    const router = inject(Router);

    if (window.location.hostname !== 'app.notionable.net') {
        return true;
    }

    const testIds = [
        'toto791@gmail.com',
        'crefestudio@gmail.com',
        'mnmlogg@gmail.com'
    ];

    const memberUid = localStorage.getItem('member_uid')?.trim();

    if (memberUid && testIds.includes(memberUid)) {
        return true;
    }

    return router.createUrlTree(['/unauthorized']);
};