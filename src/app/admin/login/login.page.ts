import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController, IonContent, Platform } from '@ionic/angular';
import { Keyboard } from '@capacitor/keyboard';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('loginContainer') loginContainer!: ElementRef;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  showPassword = false;
  private keyboardHeight = 0;
  private isNative = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private platform: Platform
  ) {
    this.isNative = this.platform.is('ios') || this.platform.is('android');
  }

  ngOnInit() {
    // Only use Keyboard plugin on native platforms
    if (this.isNative) {
      // Listen for keyboard events
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.keyboardHeight = info.keyboardHeight;
      });

      Keyboard.addListener('keyboardDidShow', (info) => {
        this.keyboardHeight = info.keyboardHeight;
        setTimeout(() => {
          this.scrollToActiveInput();
        }, 100);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        this.keyboardHeight = 0;
      });

      Keyboard.addListener('keyboardDidHide', () => {
        this.keyboardHeight = 0;
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 100);
      });
    }
  }

  async login() {
    if (this.form.invalid) return;
    
    const loading = await this.loadingCtrl.create({
      message: 'Logging in...',
      spinner: 'crescent'
    });
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
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMsg.includes('access restricted') || errorMsg.includes('admin')) {
          errorMessage = 'Access denied. Admin privileges required.';
        } else if (errorMsg.includes('auth/user-not-found') || errorMsg.includes('auth/wrong-password')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (errorMsg.includes('auth/too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (errorMsg.includes('auth/requests-from-referer') || errorMsg.includes('localhost')) {
          errorMessage = 'Authentication service temporarily unavailable. Please try again in a few minutes.';
        } else if (errorMsg.includes('auth/invalid-email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorMsg.includes('auth/weak-password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else {
          errorMessage = error.message;
        }
      }
      
      await this.showError(errorMessage);
    }
  }

  onInputFocus(event: any) {
    // Try multiple methods to ensure the input is visible
    
    // Method 1: Direct element scroll into view
    try {
      event.target.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    } catch (e) {
      console.error('scrollIntoView failed:', e);
    }
    
    // Method 2: Window scroll to element
    setTimeout(() => {
      try {
        const rect = event.target.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top - 200;
        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      } catch (e) {
        console.error('window.scrollTo failed:', e);
      }
    }, 100);
    
    // Method 3: Ion-content scroll as backup
    setTimeout(() => {
      try {
        this.content.scrollToTop(300);
      } catch (e) {
        console.error('ion-content scroll failed:', e);
      }
    }, 200);
    
    // Method 4: Force scroll down after keyboard appears
    setTimeout(() => {
      try {
        window.scrollTo({
          top: 300,
          behavior: 'smooth'
        });
      } catch (e) {
        console.error('final scroll failed:', e);
      }
    }, 500);
    
    // Method 5: Last resort - direct scroll
    setTimeout(() => {
      try {
        const element = event.target.closest('ion-item');
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          });
        }
      } catch (e) {
        console.error('element scroll failed:', e);
      }
    }, 800);
  }

  onInputBlur(event: any) {
    // Input blurred
  }

  onScroll(event: any) {
    // Handle scroll events if needed
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private async scrollToActiveInput() {
    // Try to find active element and scroll to it
    try {
      const activeElement = document.activeElement;
      if (activeElement) {
        activeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    } catch (error) {
      console.error('Error scrolling to active input:', error);
    }
  }

  private async scrollToInput(inputElement: any) {
    // Use scrollIntoView as primary method
    try {
      inputElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
    } catch (error) {
      console.error('Error scrolling to input:', error);
    }
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
      
      try {
        const toast = await this.toastCtrl.create({
          message: message,
          duration: 4000,
          position: 'top',
          color: 'danger',
          buttons: [
            {
              text: 'OK',
              role: 'cancel'
            }
          ]
        });
        await toast.present();
      } catch (toastError) {
        console.error('Error showing toast:', toastError);
        console.error('Admin login error:', message);
        alert(message);
      }
    }
  }
}