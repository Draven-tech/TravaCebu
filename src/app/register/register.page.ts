import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController, IonContent, Platform } from '@ionic/angular';
import { Keyboard } from '@capacitor/keyboard';
import { AuthUiMessages } from '../constants/auth-ui-messages';
import { firebaseAuthCode, isReferrerBlockedAuth } from '../utils/auth-firebase-error.util';

@Component({
  standalone: false,
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('registerContainer') registerContainer!: ElementRef;

  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  firstName: string = '';
  lastName: string = '';
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
    if (!this.firstName || !this.lastName || !this.username || !this.email || !this.password || !this.confirmPassword) {
      await this.showAlert(AuthUiMessages.registration.titleValidation, AuthUiMessages.registration.missingFields);
      return;
    }

    if (!this.agreed) {
      await this.showAlert(AuthUiMessages.registration.titleAgreement, AuthUiMessages.registration.agreementRequired);
      return;
    }

    if (this.password !== this.confirmPassword) {
      await this.showAlert(AuthUiMessages.registration.titlePassword, AuthUiMessages.registration.passwordMismatch);
      return;
    }

    if (this.password.length < 6) {
      await this.showAlert(AuthUiMessages.registration.titlePassword, AuthUiMessages.registration.passwordLength);
      return;
    }

    try {
      // Create user account
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(this.email, this.password);
      const user = userCredential.user;

      if (user) {
        // Save user profile to Firestore
        try {
          await this.firestore.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: this.email,
            firstName: this.firstName,
            lastName: this.lastName,
            fullName: [this.firstName, this.lastName]
              .map((s) => (s || '').trim())
              .filter(Boolean)
              .join(' '),
            username: this.username,
            createdAt: new Date(),
            photoURL: null
          });

          await this.showAlert(AuthUiMessages.registration.titleSuccess, AuthUiMessages.registration.success);
          this.navCtrl.navigateRoot('/login');
        } catch (firestoreError) {
          await this.showAlert(AuthUiMessages.registration.titleProfileError, AuthUiMessages.registration.profileSaveFailed);
          console.error('Firestore error:', firestoreError);
        }
      }
    } catch (authError: unknown) {
      console.error('Registration error:', authError);

      let message: string = AuthUiMessages.registration.generic;
      const code = firebaseAuthCode(authError);

      if (code) {
        switch (code) {
          case 'auth/email-already-in-use':
            message = AuthUiMessages.registration.emailInUse;
            break;
          case 'auth/invalid-email':
            message = AuthUiMessages.registration.invalidEmail;
            break;
          case 'auth/weak-password':
            message = AuthUiMessages.registration.weakPassword;
            break;
          case 'auth/network-request-failed':
            message = AuthUiMessages.registration.network;
            break;
          default:
            message = isReferrerBlockedAuth(code)
              ? AuthUiMessages.registration.serviceUnavailable
              : AuthUiMessages.registration.generic;
            break;
        }
      }

      await this.showAlert(AuthUiMessages.registration.titleError, message);
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
