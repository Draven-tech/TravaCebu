import { Component } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  email: string = '';
  password: string = '';

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {}
async loginUser() {
  try {
    const userCredential = await this.authService.loginUser(this.email, this.password);
    const uid = await this.authService.getCurrentUid(); // Or get directly from userCredential.user?.uid

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

}
