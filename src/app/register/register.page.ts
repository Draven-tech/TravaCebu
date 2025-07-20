import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController, IonContent, Platform } from '@ionic/angular';
import { Keyboard } from '@capacitor/keyboard';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false, 
})
export class RegisterPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('registerContainer') registerContainer!: ElementRef;

  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  fullName: string = '';
  username: string = '';
  agreed: boolean = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private platform: Platform
  ) {
    this.isNative = this.platform.is('ios') || this.platform.is('android');
  }

  private isNative = false;

  ngOnInit() {
    // Only use Keyboard plugin on native platforms
    if (this.isNative) {
      // Listen for keyboard events
      Keyboard.addListener('keyboardWillShow', (info) => {
        // Keyboard will show
      });

      Keyboard.addListener('keyboardDidShow', (info) => {
        setTimeout(() => {
          this.scrollToActiveInput();
        }, 100);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        // Keyboard will hide
      });

      Keyboard.addListener('keyboardDidHide', () => {
        setTimeout(() => {
          this.content.scrollToTop(300);
        }, 100);
      });
    }
  }

  async register() {
    // Validate form
    if (!this.fullName || !this.username || !this.email || !this.password || !this.confirmPassword) {
      await this.showAlert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!this.agreed) {
      await this.showAlert('Agreement Required', 'Please accept the terms of service and privacy policy.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      await this.showAlert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (this.password.length < 6) {
      await this.showAlert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(this.email, this.password);
      const uid = userCredential.user?.uid;

      try {
        await this.firestore.collection('users').doc(uid).set({
          fullName: this.fullName,
          username: this.username,
          email: this.email,
          createdAt: new Date()
        });

        await this.showAlert('Success', 'Registration successful! You can now login.');
        this.navCtrl.navigateRoot('/login');
      } catch (firestoreError) {
        await this.showAlert('Firestore Error', 'Account was created but user profile failed to save. Please contact support.');
        console.error('Firestore error:', firestoreError);
      }

    } catch (authError: any) {
      console.error('Registration error:', authError);
      
      let message = 'Registration failed. Please try again.';
      
      if (authError.code) {
        switch (authError.code) {
          case 'auth/email-already-in-use':
            message = 'Email is already registered. Please login instead.';
            break;
          case 'auth/invalid-email':
            message = 'Please enter a valid email address.';
            break;
          case 'auth/weak-password':
            message = 'Password is too weak. Please use a stronger password.';
            break;
          case 'auth/network-request-failed':
            message = 'Network error. Please check your internet connection and try again.';
            break;
          case 'auth/requests-from-referer-https://localhost-are-blocked':
            message = 'Authentication service temporarily unavailable. Please try again in a few minutes.';
            break;
          default:
            message = authError.message || 'Registration failed. Please try again.';
        }
      }

      await this.showAlert('Registration Error', message);
    }
  }

  onInputFocus(event: any) {
    // Immediate scroll attempt
    setTimeout(() => {
      this.scrollToInput(event.target);
    }, 50);
    
    // Additional scroll after keyboard animation starts
    setTimeout(() => {
      this.scrollToInput(event.target);
    }, 300);
    
    // Final scroll attempt to ensure full visibility
    setTimeout(() => {
      this.scrollToInput(event.target);
    }, 600);
    
    // Extra scroll attempt for stubborn cases
    setTimeout(() => {
      this.scrollToInput(event.target);
    }, 1000);
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

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private async scrollToActiveInput() {
    try {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT')) {
        await this.scrollToInput(activeElement);
      }
    } catch (error) {
      console.error('Error scrolling to active input:', error);
    }
  }

  private async scrollToInput(inputElement: any) {
    try {
      const element = inputElement.closest('.form-group');
      if (element) {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const elementBottom = rect.bottom;
        const elementTop = rect.top;
        const elementHeight = rect.height;
        
        // Estimate keyboard height (40% of viewport)
        const keyboardHeight = viewportHeight * 0.4;
        const visibleArea = viewportHeight - keyboardHeight;
        
        // Calculate how much space we want above the input field
        const desiredTopSpace = 160; // Increased from 140 to give more space
        
        // If element bottom is below visible area, scroll it up with more space
        if (elementBottom > visibleArea) {
          const scrollAmount = elementBottom - visibleArea + 150; // Increased extra space
          await this.content.scrollByPoint(0, scrollAmount, 300);
        }
        
        // Also ensure element top is visible and not too close to top
        if (elementTop < desiredTopSpace) {
          const scrollAmount = elementTop - desiredTopSpace;
          await this.content.scrollByPoint(0, scrollAmount, 300);
        }
        
        // Additional check to ensure the entire input field is visible with extra space
        if (elementBottom - elementHeight < visibleArea && elementBottom > visibleArea) {
          const scrollAmount = elementBottom - visibleArea + 120;
          await this.content.scrollByPoint(0, scrollAmount, 300);
        }
        
        // Final adjustment to ensure the input field is comfortably visible
        const finalRect = element.getBoundingClientRect();
        if (finalRect.bottom > visibleArea - 50) { // Leave 50px buffer
          const finalScrollAmount = finalRect.bottom - (visibleArea - 50);
          await this.content.scrollByPoint(0, finalScrollAmount, 200);
        }
      }
    } catch (error) {
      console.error('Error scrolling to input:', error);
    }
  }

  private async showAlert(header: string, message: string) {
    try {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: ['OK'],
        cssClass: 'custom-alert'
      });
      await alert.present();
    } catch (alertError) {
      console.error('Error showing alert:', alertError);
      // Fallback to browser alert
      alert(`${header}: ${message}`);
    }
  }
}

