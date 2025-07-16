import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BucketService } from '../services/bucket-list.service';


@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.page.html',
  styleUrls: ['./user-dashboard.page.scss'],
  standalone: false,
})
export class UserDashboardPage implements OnInit {
  userId: string | null = null;
  userData: any = null;
  spots: any[] = [];
  isLoading = true;
  tags = ['All', 'Attraction', 'Mall', 'Beach', 'Landmark', 'Museum', 'Park'];
  selectedTag = 'All';
  originalSpots: any[] = [];


  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private afAuth: AngularFireAuth,
    private bucketService: BucketService
  ) { }

  async ngOnInit() {
    // 1. Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    console.log('✅ Logged-in Firebase UID:', currentUser?.uid);

    // 2. Get UID from route (optional)
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    console.log('✅ UID from route or auth:', this.userId);

    if (!this.userId) {
      console.warn('❌ No userId found.');
      return;
    }

    // 3. Load user profile data
    this.firestore
      .collection('users')
      .doc(this.userId)
      .valueChanges()
      .subscribe(
        (data) => {
          console.log('✅ Firestore user data:', data);
          this.userData = data;
        },
        (error) => {
          console.error('❌ Firestore user load error:', error);
        }
      );

    // 4. Load tourist spots
    this.loadSpots();
  }

 loadSpots() {
  this.isLoading = true;
  this.firestore
    .collection('tourist_spots', (ref) => ref.orderBy('createdAt', 'desc'))
    .valueChanges({ idField: 'id' })
    .subscribe({
      next: (data) => {
        this.originalSpots = data;
        this.applyFilter(); // filter based on current tag
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading tourist spots:', err);
        this.isLoading = false;
      },
    });
}

selectTag(tag: string): void {
  this.selectedTag = tag;
  this.applyFilter();
}

applyFilter(): void {
  if (this.selectedTag === 'All') {
    this.spots = this.originalSpots;
  } else {
    this.spots = this.originalSpots.filter(
      spot => spot.category?.toLowerCase() === this.selectedTag.toLowerCase()
    );
  }
}
  addToTrip(spot: any) {
    this.bucketService.addToBucket(spot);
  }
  async logout() {
    await this.authService.logoutUser();
  }

}

