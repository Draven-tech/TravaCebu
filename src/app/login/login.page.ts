import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { AlertController, NavController, IonContent } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

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

  private headerTapCount = 0;
  private tapTimeout: any;

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private router: Router
  ) {}

  ngOnInit() {
    // No keyboard handling needed for user login
  }

  async loginUser() {
    if (!this.email || !this.password) {
      await this.showError('Please enter both email and password.');
      return;
    }

    try {
      const userCredential = await this.authService.loginUser(this.email, this.password);
      const uid = await this.authService.getCurrentUid(); 

      if (uid) {
        this.navCtrl.navigateRoot(`/user-dashboard/${uid}`);
      } else {
        throw new Error('Failed to get user UID');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('auth/user-not-found') || errorMsg.includes('auth/wrong-password')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (errorMsg.includes('auth/too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (errorMsg.includes('auth/requests-from-referer') || errorMsg.includes('localhost')) {
          errorMessage = 'Authentication service temporarily unavailable. Please try again in a few minutes.';
        } else if (errorMsg.includes('auth/invalid-email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorMsg.includes('user profile not found')) {
          errorMessage = 'User account not found. Please check your credentials.';
        } else {
          errorMessage = error.message;
        }
      }
      
      await this.showError(errorMessage);
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
        header: 'Login Error',
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