import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private alertController = inject(AlertController);
  private router = inject(Router);
  private loadingController = inject(LoadingController);

  credentials = this.fb.group({
    email: ['admin@trava.com', [Validators.required, Validators.email]],
    password: ['admin123', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.credentials = this.fb.group({
      email: ['admin@trava.com', [Validators.required, Validators.email]],
      password: ['admin123', [Validators.required, Validators.minLength(6)]],
    });
  }

  async login() {
    const loading = await this.loadingController.create();
    await loading.present();

    try {
      const credentials = {
        email: this.credentials.value.email ?? '',
        password: this.credentials.value.password ?? ''
      };

      await this.authService.adminLogin(credentials);
      await loading.dismiss();
      this.router.navigateByUrl('/admin/dashboard', { replaceUrl: true });
    } catch (error: any) {
      await loading.dismiss();
      await this.showErrorAlert('Login Failed', error.message);
    }
  }

  private async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  get email() {
    return this.credentials.get('email');
  }

  get password() {
    return this.credentials.get('password');
  }
}