import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './services/admin-auth.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const authSvc = inject(AdminAuthService);
  const router = inject(Router);
  await authSvc.auth.authStateReady();
  const ok = await authSvc.ensureAdmin();
  if (ok) return true;

  const onLogin = /\/admin\/login$/i.test(state.url);
  if (!onLogin) {
    sessionStorage.setItem('tc_return', state.url);
  }
  await router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
