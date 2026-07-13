import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const memberGuard: CanActivateFn = () => {
    const router = inject(Router);

    if (window.location.hostname !== 'app.notionable.net') {
        return true;
    }

    const memberUid = localStorage.getItem('member_uid')?.trim();

    if (memberUid) {
        return true;
    }

    return router.createUrlTree(['/unauthorized']);
};

// import { AuthService } from './auth.service';
// export const workspaceGuard: CanActivateFn = () => {
//     const router = inject(Router);
//     const auth = inject(AuthService);

//     if (window.location.hostname !== 'app.notionable.net') {
//         return true;
//     }

//     if (auth.getUserId()) {
//         return true;
//     }

//     return router.createUrlTree(['/unauthorized']);
// };