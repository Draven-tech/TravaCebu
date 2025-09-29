import { Component } from '@angular/core';
import { Platform }  from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router }    from '@angular/router';

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
    private router: Router
  ) {
    this.platform.ready().then(() => {
      this.afAuth.authState.subscribe(user => {
        if (user) {
          // user.uid is available, so skip login
          this.router.navigateByUrl(`/user-dashboard/${user.uid}`, { replaceUrl: true });
        } else {
          this.router.navigateByUrl('/welcome', { replaceUrl: true });
        }
      });
    });
  }
}
