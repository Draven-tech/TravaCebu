// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  canActivate() {
    return this.afAuth.authState.pipe(
      map(user => {
        if (user) {
          this.router.navigateByUrl(`/user-dashboard/${user.uid}`, { replaceUrl: true });
          return false;
        }
        return true;
      })
    );
  }
}
