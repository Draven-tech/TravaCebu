import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
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
  alertCtrl: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController
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
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();
    }
  }
}