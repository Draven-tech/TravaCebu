import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.page.html',
  styleUrls: ['./user-dashboard.page.scss'],
  standalone: false,
})
export class UserDashboardPage implements OnInit {
  userId: string | null = null;
  userData: any = null;

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private afAuth: AngularFireAuth
  ) {}

  async ngOnInit() {
    const currentUser = await this.afAuth.currentUser;
    console.log('✅ Logged-in Firebase UID:', currentUser?.uid);

    this.userId = this.route.snapshot.paramMap.get('uid');
    console.log('✅ UID from route:', this.userId);

    if (!this.userId) {
      console.warn('❌ No userId found in route.');
      return;
    }

    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(data => {
      console.log('✅ Firestore user data:', data);
      this.userData = data;
    }, error => {
      console.error('❌ Firestore subscription error:', error);
    });
  }

  async logout() {
    await this.authService.logoutUser();
  }
}
