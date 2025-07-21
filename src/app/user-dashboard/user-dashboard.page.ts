import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BucketService } from '../services/bucket-list.service';
import { NavController, ToastController } from '@ionic/angular';

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
  visitedSpots: any[] = []; // ✅ added for history
  isLoading = true;
  tags = ['All', 'Attraction', 'Mall', 'Beach', 'Landmark', 'Museum', 'Park'];
  selectedTag = 'All';
  originalSpots: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private afAuth: AngularFireAuth,
    private bucketService: BucketService,
    private navCtrl: NavController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }

    this.firestore
      .collection('users')
      .doc(this.userId)
      .valueChanges()
      .subscribe((data) => {
        this.userData = data;
      });

    // Load tourist spots
    this.firestore
      .collection('tourist_spots')
      .valueChanges({ idField: 'id' })
      .subscribe((spots) => {
        this.spots = spots;
        this.originalSpots = spots;
        this.applyFilter();
        this.isLoading = false;
      });

    // ✅ Load visited spots
    this.firestore
      .collection('users')
      .doc(this.userId)
      .collection('visitedSpots', ref => ref.orderBy('visitedAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe((visited) => {
        this.visitedSpots = visited;
      });
  }

  loadSpots() {
    this.isLoading = true;
    this.firestore
      .collection('tourist_spots', (ref) => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (data) => {
          this.originalSpots = data;
          this.applyFilter();
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

  async openSpotDetail(spotId: string) {
    const spot = this.spots.find(s => s.id === spotId);
    if (spot && this.userId) {
      await this.logVisitedSpot(spot); // ✅ track the visit
    }
    this.navCtrl.navigateForward(`/tourist-spot-detail/${spotId}`);
  }

  // ✅ Save spot to user's visited history
  async logVisitedSpot(spot: any) {
    if (!this.userId || !spot?.id) return;

    const visitedRef = this.firestore
      .collection('users')
      .doc(this.userId)
      .collection('visitedSpots')
      .doc(spot.id);

    await visitedRef.set(
      {
        spotId: spot.id,
        name: spot.name,
        img: spot.img || '',
        visitedAt: new Date(),
      },
      { merge: true }
    );
  }

  applyFilter(): void {
    if (this.selectedTag === 'All') {
      this.spots = this.originalSpots;
    } else {
      this.spots = this.originalSpots.filter(
        (spot) => spot.category?.toLowerCase() === this.selectedTag.toLowerCase()
      );
    }
  }

  async addToTrip(spot: any) {
    this.bucketService.addToBucket(spot);

    const toast = await this.toastCtrl.create({
      message: `${spot.name} added to bucket list!`,
      duration: 2000,
      color: 'success',
      position: 'top',
      buttons: [
        {
          icon: 'checkmark-circle',
          side: 'start',
        },
      ],
    });
    toast.present();
  }

  async logout() {
    await this.authService.logoutUser();
  }
}
