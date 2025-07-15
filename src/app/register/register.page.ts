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
  fullName: string = '';

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {}

async register() {
  try {
    const userCredential = await this.afAuth.createUserWithEmailAndPassword(this.email, this.password);
    const uid = userCredential.user?.uid;

    // Separate Firestore write in its own try-catch
    try {
      await this.firestore.collection('users').doc(uid).set({
        email: this.email,
        fullName: this.fullName,
        createdAt: new Date()
      });

      // ✅ Registration successful
      const alert = await this.alertCtrl.create({
        header: 'Success',
        message: 'Registration successful!',
        buttons: ['OK']
      });
      await alert.present();

      this.navCtrl.navigateRoot('/user-login'); // Or wherever you want
    } catch (firestoreError) {
      console.error('Firestore write error:', firestoreError);

      const alert = await this.alertCtrl.create({
        header: 'Firestore Error',
        message: 'Account was created but user profile failed to save.',
        buttons: ['OK']
      });
      await alert.present();
    }

  } catch (authError: any) {
    console.error('Auth error:', authError);

    let message = 'Something went wrong.';
    if (authError.code === 'auth/email-already-in-use') {
      message = 'Email is already registered. Please login instead.';
    }

    const alert = await this.alertCtrl.create({
      header: 'Registration Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}

}
