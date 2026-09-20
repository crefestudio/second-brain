import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SocialAuthService } from './social-auth.service';

export const memberGuard: CanActivateFn = async (_route, state) => {
    const router = inject(Router);
    const auth = inject(SocialAuthService);
    await auth.init();
    return auth.account() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
