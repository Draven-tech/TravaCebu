import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private authService: AuthService
  ) {}

  /**
   * Guest-only routes (welcome/register/login): send logged-in users to the right home.
   * Admins are not guaranteed to have a `users/{uid}` doc — never send them to user-dashboard only.
   */
  async canActivate(): Promise<boolean> {
    const user = await firstValueFrom(this.afAuth.authState.pipe(take(1)));
    if (!user) {
      return true;
    }
    if (await this.authService.isAdmin()) {
      await this.router.navigateByUrl('/admin/dashboard', { replaceUrl: true });
      return false;
    }
    if (await this.authService.isUser()) {
      await this.router.navigateByUrl(`/user-dashboard/${user.uid}`, { replaceUrl: true });
      return false;
    }
    await this.afAuth.signOut();
    return true;
  }
}
