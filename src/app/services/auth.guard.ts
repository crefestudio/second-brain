import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SocialAuthService } from './social-auth.service';
import { UserService } from './user.service';
import { entryTemplate } from '../config/app-entry';

export const memberGuard: CanActivateFn = async (_route, state) => {
    const router = inject(Router);
    const auth = inject(SocialAuthService);
    const raw = _route.queryParamMap.get('templateId');
    const target = entryTemplate(raw);
    if (raw && !target) return router.createUrlTree(['/unauthorized']);
    let selected = target;
    try {
        const session = await auth.session(undefined, target);
        selected = target || entryTemplate(session?.templateId);
        if (session?.userId && (!target || session.templateId === target)) {
            const purchase = await UserService.getPurchaseInfo(session.userId, session.templateId);
            if (purchase?.verified === true) return true;
        }
    } catch { /* The verification screen supports retrying the purchase lookup. */ }
    return router.createUrlTree(['/verify-purchase'], {
        queryParams: { returnUrl: state.url, ...(selected ? { templateId: selected } : {}) }
    });
};
