import { Injectable, inject } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private afAuth = inject(AngularFireAuth);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private firestore = inject(AngularFirestore);

  /**
   * Admin login with email/password
   */
  async adminLogin(credentials: { email: string; password: string }) {
    try {
      // 1. Sign in with email/password
      const userCredential = await this.afAuth.signInWithEmailAndPassword(
        credentials.email,
        credentials.password
      );
      
      // 2. Check if user exists in admins collection
      const adminDoc = await this.firestore.collection('admins')
        .doc(userCredential.user?.uid)
        .get()
        .toPromise();

      if (!adminDoc?.exists) {
        await this.afAuth.signOut();
        throw new Error('Access restricted to admins only');
      }

      // 3. Navigate to dashboard
      this.router.navigate(['/admin/dashboard']);
      return true;
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Check if user is admin (Firestore-based verification)
   */
  private async verifyAdmin(uid?: string): Promise<boolean> {
    if (!uid) return false;
    
    const doc = await this.firestore.collection('admins').doc(uid).get().toPromise();
    return doc?.exists || false;
  }

  /**
   * Get current authentication state
   */
  getCurrentUser() {
    return this.afAuth.currentUser;
  }

  /**
   * Check if user is logged in as admin
    */
  async isAdmin(): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    if (!user?.uid) return false;
    
    const doc = await this.firestore.collection('admins').doc(user.uid).get().toPromise();
    return !!doc?.exists;
  }

  /**
   * Logout user
   */
  async logout() {
    await this.afAuth.signOut();
    this.router.navigate(['/admin/login']);
  }

  /**
   * Show error alert (reusable)
   */
  async showError(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}