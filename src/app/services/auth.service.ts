import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private afAuth: AngularFireAuth,
    private router: Router,
    private alertCtrl: AlertController,
    private firestore: AngularFirestore
  ) {}

  async adminLogin(email: string, password: string) {
    try {
      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);
      const adminDoc = await this.firestore.collection('admins').doc(userCredential.user?.uid).get().toPromise();
      
      if (!adminDoc?.exists) {
        await this.afAuth.signOut();
        throw new Error('Access restricted to admins only');
      }

      this.router.navigate(['/admin/dashboard']);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async isAdmin(): Promise<boolean> {
    const user = await this.afAuth.currentUser;
    if (!user?.uid) return false;
    
    const adminDoc = await this.firestore.collection('admins')
      .doc(user.uid)
      .get()
      .toPromise();
      
    return adminDoc?.exists || false;
  }

  async logout() {
    await this.afAuth.signOut();
    this.router.navigate(['/admin/login']);
  }
}