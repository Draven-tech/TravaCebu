import { Component } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  email: string = '';
  password: string = '';

  private headerTapCount = 0;
  private tapTimeout: any;

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private router: Router
  ) {}

  
async loginUser() {
  try {
    const userCredential = await this.authService.loginUser(this.email, this.password);
    const uid = await this.authService.getCurrentUid(); 

    if (uid) {
      this.navCtrl.navigateRoot(`/user-dashboard/${uid}`);
    } else {
      throw new Error('Failed to get user UID');
    }
  } catch (error: any) {
    const alert = await this.alertCtrl.create({
      header: 'Login Error',
      message: error.message || 'Something went wrong.',
      buttons: ['OK']
    });
    await alert.present();
  }
}

tapHeader() {
    this.headerTapCount++;

    clearTimeout(this.tapTimeout);
    this.tapTimeout = setTimeout(() => {
      this.headerTapCount = 0;
    }, 1000);

    if (this.headerTapCount === 5) {
      this.headerTapCount = 0;
      this.router.navigate(['/admin/login']);
    }
  }

}
