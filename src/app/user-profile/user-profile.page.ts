import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { NavController } from '@ionic/angular';

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
    private authService: AuthService,
    private navCtrl: NavController,
  ) {}

  async ngOnInit() {
    const user = await this.afAuth.currentUser;
    if (user?.uid) {
      this.firestore.collection('users').doc(user.uid).valueChanges().subscribe(data => {
        this.userData = data;
      });
    }
  }
 async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);

    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }
  async logout() {
    await this.authService.logoutUser();
  }
}
