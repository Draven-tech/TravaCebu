import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { NavController, ToastController, ModalController, AlertController } from '@ionic/angular';

import { AuthService } from '../services/auth.service';
import { BucketService } from '../services/bucket-list.service';
import { PlacesService } from '../services/places.service';
import { PendingTouristSpotService } from '../services/pending-tourist-spot.service';
import { GeofencingService } from '../services/geofencing.service';
import { SearchModalComponent } from '../modals/search-modal/search-modal.component';
import { VisitedSpotsModalComponent } from '../modals/visited-spots-modal/visited-spots-modal.component';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.page.html',
  styleUrls: ['./user-dashboard.page.scss'],
  standalone: false,
})
export class UserDashboardPage implements OnInit, OnDestroy {
  // ✅ User and app state
  userId: string | null = null;
  userData: any = null;
  isLoading = true;

  // ✅ Data arrays
  allSpots: any[] = [];       // All spots from Firestore
  filteredSpots: any[] = [];  // Spots after filtering/search
  bucketList: any[] = [];     // User’s saved spots
  visitedSpots: any[] = [];   // Spots the user has visited
  bucketSpotIds: string[] = [];

  // ✅ UI state
  searchQuery = '';
  tags = ['All', 'Attraction', 'Mall', 'Beach', 'Landmark', 'Museum', 'Park'];
  selectedTag = 'All';

  // ✅ Pagination
  currentPage = 1;
  itemsPerPage = 6;
  paginatedSpots: any[] = [];
  totalPages = 1;

  private spotsSubscription: any;

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private bucketService: BucketService,
    private placesService: PlacesService,
    private pendingSpotService: PendingTouristSpotService,
    private geofencingService: GeofencingService
  ) {}

  // 🔹 Life Cycle Hooks
  async ngOnInit() {
    this.setupNetworkListeners();

    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) return;

    this.loadUserProfile();
    this.loadBucketList();
    this.loadSpots();
    this.loadVisitedSpots();
    this.loadBucketStatus();
  }

  ngOnDestroy() {
    if (this.spotsSubscription) this.spotsSubscription.unsubscribe();
    window.removeEventListener('offline', this.showOfflineAlert);
    window.removeEventListener('online', this.showOnlineToast);
  }

  // 🔹 Firebase Data Loading
  loadUserProfile() {
    this.firestore.collection('users').doc(this.userId!).valueChanges().subscribe(data => {
      this.userData = data;
    });
  }

  loadSpots() {
    this.isLoading = true;

    if (this.spotsSubscription) this.spotsSubscription.unsubscribe();

    this.spotsSubscription = this.firestore
      .collection('tourist_spots')
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (spots) => {
          // Sort ascending by popularity to show hidden gems first
          this.allSpots = this.sortByPopularity(spots);
          this.applyFilters();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading tourist spots:', err);
          this.isLoading = false;
        },
      });
  }

loadBucketList() {
  if (!this.userId) return;

  this.firestore
    .collection(`users/${this.userId}/bucketList`)
    .valueChanges({ idField: 'id' })
    .subscribe((bucket) => {
      this.bucketList = bucket;
      this.bucketSpotIds = bucket.map((s) => s.id);
    });
}

  async loadVisitedSpots() {
    if (!this.userId) return;

    try {
      const snapshot = await this.firestore
        .collection(`users/${this.userId}/visitedSpots`, ref => ref.orderBy('visitedAt', 'desc'))
        .get()
        .toPromise();

      const visitedEntries: any[] =
        snapshot?.docs.map(doc => {
          const data = (doc.data() || {}) as any;
          const spotId = data.spotId || doc.id;
          return {
            id: doc.id,
            spotId,
            ...data,
          };
        }) || [];

      const uniqueSpotIds = Array.from(
        new Set(
          visitedEntries
            .map((entry: any) => entry.spotId)
            .filter((spotId: any) => Boolean(spotId))
        )
      );

      const spotDataMap = new Map<string, any>();

      if (uniqueSpotIds.length) {
        await Promise.all(
          uniqueSpotIds.map(async spotId => {
            try {
              const docSnapshot = await this.firestore.collection('tourist_spots').doc(spotId).get().toPromise();
              if (docSnapshot?.exists) {
                spotDataMap.set(spotId, docSnapshot.data());
              }
            } catch (error) {
              console.warn(`Error fetching tourist spot details for ${spotId}:`, error);
            }
          })
        );
      }

      this.visitedSpots = visitedEntries.map((entry: any) => {
        const spotData: any = spotDataMap.get(entry.spotId) || {};
        return {
          ...spotData,
          ...entry,
          spotId: entry.spotId,
          name: entry.name || spotData.name || 'Unknown Spot',
          img: entry.img || spotData.img || 'assets/img/default.png',
        };
      });
    } catch (error) {
      console.error('Error loading visited spots:', error);
    }
  }

  async loadBucketStatus() {
    try {
      this.bucketSpotIds = await this.bucketService.getBucketSpotIds();
    } catch (err) {
      console.error('Error loading bucket status:', err);
    }
  }

  // 🔹 Bucket List Logic
  isInBucketList(spotId: string): boolean {
    return this.bucketList.some(s => s.id === spotId);
  }

  async toggleBucketList(spot: any) {
    if (this.isInBucketList(spot.id)) {
      await this.removeFromBucketList(spot.id);
      this.showAlert('Removed', `${spot.name} has been removed from your bucket list.`);
    } else {
      const confirmAdd = await this.alertCtrl.create({
        header: 'Add to Bucket List',
        message: `Would you like to add ${spot.name} to your bucket list?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Add',
            handler: async () => {
              await this.addToBucketList(spot);
              this.showToast(`${spot.name} added to bucket list!`, 'success');
            },
          },
        ],
      });
      await confirmAdd.present();
    }
  }

  async addToBucketList(spot: any) {
    await this.bucketService.addToBucket(spot);
    await this.loadBucketList();
  }

  async removeFromBucketList(spotId: string) {
    await this.bucketService.removeFromBucket(spotId);
    await this.loadBucketList();
  }

  // 🔹 Filtering & Searching
  selectTag(tag: string) {
    this.selectedTag = tag;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchInput(event: any) {
    this.searchQuery = event.detail.value || '';
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = this.selectedTag === 'All'
      ? this.allSpots
      : this.allSpots.filter(spot =>
          spot.category?.toLowerCase() === this.selectedTag.toLowerCase()
        );

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        spot =>
          spot.name?.toLowerCase().includes(q) ||
          spot.description?.toLowerCase().includes(q)
      );
    }

    this.filteredSpots = filtered;
    this.updatePagination();
  }

  // 🔹 Pagination
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredSpots.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedSpots = this.filteredSpots.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // 🔹 Spot Interactions
  openSpotDetail(spotId: string) {
    this.navCtrl.navigateForward(`/tourist-spot-detail/${spotId}`);
  }

  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }

  async openSearchModal() {
    const modal = await this.modalCtrl.create({
      component: SearchModalComponent,
      cssClass: 'search-modal',
      componentProps: { existingSpots: this.allSpots },
    });

    await modal.present();
    const result = await modal.onDidDismiss();

    if (result.data?.action === 'add') {
      await this.addTouristSpotToDatabase(result.data.place);
    }
  }

  // 🔹 Add New Tourist Spot
async addTouristSpotToDatabase(place: any) {
  try {
    if (this.isDuplicateSpot(place)) {
      this.showToast(`"${place.name}" already exists in our database.`, 'warning');
      return;
    }

    const details = await this.placesService.getPlaceDetails(place.place_id).toPromise();

    // Try to get a photo early
    let imageUrl = 'assets/default-spot.jpg'; // ✅ fallback image
    try {
      const photoRes = await this.placesService.getPlacePhotos(place.place_id).toPromise();
      if (photoRes.result?.photos?.length > 0) {
        const ref = photoRes.result.photos[0].photo_reference;
        imageUrl = this.placesService.getPhotoUrl(ref);
      }
    } catch (error) {
      console.warn('No photo found for this spot');
    }

    const newSpot = {
      name: place.name,
      description:
        details.result?.formatted_address ||
        place.formatted_address ||
        'A tourist spot in Cebu, Philippines',
      category: this.getCategory(place.types),
      location: {
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      },
      googlePlaceId: place.place_id,
      rating: place.rating || 0,
      userRatingsTotal: place.user_ratings_total || 0,
      img: imageUrl, // ✅ always defined
    };

    await this.pendingSpotService.submitForApproval(newSpot);
    this.showToast(`"${place.name}" submitted for approval!`, 'success');
  } catch (error) {
    console.error('Error submitting spot:', error);
    this.showAlert('Error', 'Something went wrong while submitting. Please try again.');
  }
}


  // 🔹 Helper Methods
  private sortByPopularity(spots: any[]) {
    return spots.sort((a, b) => (a.userRatingsTotal || 0) - (b.userRatingsTotal || 0));
  }

  private getCategory(types: string[]): string {
    const typeMap: { [key: string]: string } = {
      shopping_mall: 'mall',
      amusement_park: 'attraction',
      museum: 'museum',
      park: 'park',
      tourist_attraction: 'attraction',
    };
    for (const t of types) if (typeMap[t]) return typeMap[t];
    return 'attraction';
  }

  private isDuplicateSpot(place: any) {
    const name = place.name?.toLowerCase().trim();
    return this.allSpots.some(s => s.name?.toLowerCase().trim() === name);
  }

  // 🔹 Network Status Handling
  setupNetworkListeners() {
    this.checkNetworkImmediately();
    window.addEventListener('offline', this.showOfflineAlert);
    window.addEventListener('online', this.showOnlineToast);
  }

  checkNetworkImmediately() {
    if (!navigator.onLine) this.showOfflineAlert();
  }

  showOfflineAlert = async () => {
    const alert = await this.alertCtrl.create({
      header: 'No Internet Connection',
      message:
        'You are offline. Some features may not work. You can still access saved itineraries and data.',
      buttons: ['OK'],
    });
    await alert.present();
  };

  showOnlineToast = async () => {
    this.showToast('You’re back online!', 'success');
  };

  // 🔹 UI Utilities
  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    toast.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  // 🔹 Logout
  async logout() {
    await this.authService.logoutUser();
  }
  // 🔹 Pull to Refresh Functionality
async handleRefresh(event: any) {
  try {
    await Promise.all([
      this.loadSpots(),
      this.loadVisitedSpots(),
      this.loadBucketList(),
    ]);
    event.target.complete(); // stop the refresher spinner
  } catch (error) {
    console.error('Error during refresh:', error);
    event.target.complete();
  }
}

// 🔹 Check if spot is visited
hasVisited(spotId: string): boolean {
  return this.visitedSpots.some(v => v.spotId === spotId || v.id === spotId);
}

get topVisitedSpots(): any[] {
  return this.visitedSpots.slice(0, 3);
}

async openVisitedSpotsModal(): Promise<void> {
  const modal = await this.modalCtrl.create({
    component: VisitedSpotsModalComponent,
    componentProps: {
      visitedSpots: this.visitedSpots
    },
    cssClass: 'visited-spots-modal',
    breakpoints: [0, 0.6, 0.9],
    initialBreakpoint: this.visitedSpots.length > 5 ? 0.9 : 0.6
  });

  await modal.present();
}

isSearching = false;

getVisitedDate(visitedAt: any): Date | null {
  if (!visitedAt) {
    return null;
  }

  if (visitedAt.toDate && typeof visitedAt.toDate === 'function') {
    return visitedAt.toDate();
  }

  if (visitedAt instanceof Date) {
    return visitedAt;
  }

  const timestamp = new Date(visitedAt);
  return isNaN(timestamp.getTime()) ? null : timestamp;
}

}


