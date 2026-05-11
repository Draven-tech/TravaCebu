import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { BadgeService } from './services/badge.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private afAuth: AngularFireAuth,
    private router: Router,
    private authService: AuthService,
    private badgeService: BadgeService
  ) {
    this.platform.ready().then(() => {
      this.afAuth.authState.subscribe(async (user) => {
        if (!user) {
          await this.router.navigateByUrl('/welcome', { replaceUrl: true });
          return;
        }
        try {
          if (await this.authService.isAdmin()) {
            await this.router.navigateByUrl('/admin/dashboard', { replaceUrl: true });
            return;
          }
          if (await this.authService.isUser()) {
            this.badgeService.updateLoginStreak(user.uid).catch((e) =>
              console.error('[AppComponent] updateLoginStreak failed', e)
            );
            await this.router.navigateByUrl(`/user-dashboard/${user.uid}`, { replaceUrl: true });
            return;
          }
          await this.afAuth.signOut();
          await this.router.navigateByUrl('/welcome', { replaceUrl: true });
        } catch (e) {
          console.error('[AppComponent] auth routing error', e);
          await this.router.navigateByUrl('/welcome', { replaceUrl: true });
        }
      });
    });
  }
}
