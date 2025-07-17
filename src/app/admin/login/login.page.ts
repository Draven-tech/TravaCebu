import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async login() {
    if (this.form.invalid) return;
    
    const loading = await this.loadingCtrl.create();
    await loading.present();
    
    try {
      const email = this.form.get('email')?.value ?? '';
      const password = this.form.get('password')?.value ?? '';
      
      await this.authService.adminLogin(email, password);
      await loading.dismiss();
    } catch (error: unknown) {
      await loading.dismiss();
      console.error('Admin login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('Access restricted')) {
          errorMessage = 'Access denied. Admin privileges required.';
        } else {
          errorMessage = error.message;
        }
      }
      
      await this.showError(errorMessage);
    }
  }

  private async showError(message: string) {
    try {
      // Try to show alert first
      const alert = await this.alertCtrl.create({
        header: 'Login Error',
        message: message,
        buttons: ['OK']
      });
      await alert.present();
    } catch (alertError) {
      console.error('Error showing alert:', alertError);
      
      // Fallback to toast if alert fails
      try {
        const toast = await this.toastCtrl.create({
          message: message,
          duration: 4000,
          position: 'top',
          color: 'danger'
        });
        await toast.present();
      } catch (toastError) {
        console.error('Error showing toast:', toastError);
        // Final fallback: just log the error
        console.error('Admin login error:', message);
        alert(message); // Browser alert as last resort
      }
    }
  }
}