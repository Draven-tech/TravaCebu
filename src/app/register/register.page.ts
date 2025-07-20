
import { Component } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false, 
})
export class RegisterPage {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  fullName: string = '';
  username: string = '';
  agreed: boolean = false;
  showTermsModal = false;
  modalType: 'terms' | 'privacy' = 'terms';
  modalTitle = '';

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {}

  openModal(type: 'terms' | 'privacy') {
    this.modalType = type;
    this.modalTitle = type === 'terms' ? 'Terms and Conditions' : 'Privacy Statement';
    this.showTermsModal = true;
  }

  async register() {
    if (!this.agreed) {
      this.showAlert('Agreement Required', 'Please accept the terms of service and privacy policy.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.showAlert('Password Mismatch', 'Passwords do not match.');
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

        this.showAlert('Success', 'Registration successful!');
        this.navCtrl.navigateRoot('/user-login');
      } catch (firestoreError) {
        this.showAlert('Firestore Error', 'Account was created but user profile failed to save.');
        console.error('Firestore error:', firestoreError);
      }

    } catch (authError: any) {
      let message = 'Something went wrong.';
      if (authError.code === 'auth/email-already-in-use') {
        message = 'Email is already registered. Please login instead.';
      }

      this.showAlert('Registration Error', message);
      console.error('Auth error:', authError);
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}

