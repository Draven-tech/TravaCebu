import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { AlertController, NavController, IonContent, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { AuthUiMessages, AuthErrorCodes } from '../constants/auth-ui-messages';
import {
  appThrownMessage,
  firebaseAuthCode,
  isReferrerBlockedAuth,
} from '../utils/auth-firebase-error.util';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('loginContainer') loginContainer!: ElementRef;

  email: string = '';
  password: string = '';
  showPassword = false;
  isLoading = false;

  private headerTapCount = 0;
  private tapTimeout: any;

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private router: Router
  ) {}

  ngOnInit() {
    // No keyboard handling needed for user login
  }

  async loginUser() {
    if (!this.email || !this.password) {
      await this.showError(AuthUiMessages.traveller.missingFields);
      return;
    }

    if (this.isLoading) return;

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({
      message: 'Logging in…',
      spinner: 'crescent',
      cssClass: 'tc-loading-overlay',
      backdropDismiss: false,
    });
    await loading.present();

    try {
      await this.authService.loginUser(this.email, this.password);
      const uid = await this.authService.getCurrentUid();

      if (uid) {
        await loading.dismiss();
        this.navCtrl.navigateRoot(`/user-dashboard/${uid}`);
      } else {
        throw new Error(AuthErrorCodes.uidResolutionFailed);
      }
    } catch (error: unknown) {
      await loading.dismiss();
      console.error('Login error:', error);

      let errorMessage: string = AuthUiMessages.traveller.generic;
      const thrown = appThrownMessage(error);
      const code = firebaseAuthCode(error);

      if (thrown === AuthErrorCodes.travellerProfileMissing) {
        errorMessage = AuthUiMessages.traveller.profileMissing;
      } else if (code === 'auth/invalid-email') {
        errorMessage = AuthUiMessages.traveller.invalidEmailFormat;
      } else if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        errorMessage = AuthUiMessages.traveller.invalidCredentials;
      } else if (code === 'auth/too-many-requests') {
        errorMessage = AuthUiMessages.traveller.rateLimited;
      } else if (code === 'auth/network-request-failed') {
        errorMessage = AuthUiMessages.traveller.network;
      } else if (code && isReferrerBlockedAuth(code)) {
        errorMessage = AuthUiMessages.traveller.serviceUnavailable;
      } else if (thrown && /network|fetch|offline/i.test(thrown)) {
        errorMessage = AuthUiMessages.traveller.network;
      }

      await this.showError(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  onInputFocus(event: any) {
    // No auto-adjust needed
  }

  onInputBlur(event: any) {
    // No auto-adjust needed
  }

  onScroll(event: any) {
    // Handle scroll events if needed
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private async showError(message: string) {
    try {
      const alert = await this.alertCtrl.create({
        header: AuthUiMessages.loginAlertTitle,
        message: message,
        buttons: ['OK'],
        cssClass: 'custom-alert'
      });
      await alert.present();
    } catch (alertError) {
      console.error('Error showing alert:', alertError);
      // Fallback to browser alert
      alert(message);
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
