import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.page.html',
  styleUrls: ['./user-profile.page.scss'],
  standalone: false,
})
export class UserProfilePage implements OnInit {
  userData: any = null;

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    const user = await this.afAuth.currentUser;
    if (user?.uid) {
      this.firestore.collection('users').doc(user.uid).valueChanges().subscribe(data => {
        this.userData = data;
      });
    }
  }

  async logout() {
    await this.authService.logoutUser();
  }
}
