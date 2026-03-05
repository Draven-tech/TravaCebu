// welcome.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: false,
})
export class WelcomePage {
  constructor(
    private router: Router,
    private afAuth: AngularFireAuth
  ) { }

  ionViewWillEnter() {
    this.afAuth.authState.subscribe(user => {
      if (user) {
        this.router.navigateByUrl(`/user-dashboard/${user.uid}`, { replaceUrl: true });
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
