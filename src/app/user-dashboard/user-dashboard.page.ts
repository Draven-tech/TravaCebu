import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BucketService } from '../services/bucket-list.service';
import { NavController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { PlacesService } from '../services/places.service';
import { PendingTouristSpotService } from '../services/pending-tourist-spot.service';
import { SearchModalComponent } from './search-modal.component';


@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.page.html',
  styleUrls: ['./user-dashboard.page.scss'],
  standalone: false,
})
export class UserDashboardPage implements OnInit, OnDestroy {
  userId: string | null = null;
  userData: any = null;
  spots: any[] = [];
  isLoading = true;
  searchQuery = '';
  tags = ['All', 'Attraction', 'Mall', 'Beach', 'Landmark', 'Museum', 'Park'];
  selectedTag = 'All';
  originalSpots: any[] = [];
  visitedSpots: any[] = [];
  bucketSpotIds: string[] = [];

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 6;
  paginatedSpots: any[] = [];
  totalPages = 1;

  // Search properties
  isSearching = false;
  searchResults: any[] = [];

  bucketList: any[] = [];


  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private afAuth: AngularFireAuth,
    private bucketService: BucketService,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private placesService: PlacesService,
    private pendingSpotService: PendingTouristSpotService
  ) { }

  private spotsSubscription: any;

  async ngOnInit() {
    this.loadBucketList();
    this.checkNetworkStatus(); // Check immediately on load
    window.addEventListener('offline', this.showOfflineAlert);
    window.addEventListener('online', this.showOnlineToast);
    // Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }
    // Load user profile data
    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(data => {
      this.userData = data;
    });
    // Load tourist spots with proper subscription management
    this.loadSpots();
    await this.loadVisitedSpots();
    await this.loadBucketStatus();
  }

  async loadBucketStatus() {
    try {
      this.bucketSpotIds = await this.bucketService.getBucketSpotIds();
    } catch (error) {
      console.error('Error loading bucket status:', error);
    }
  }

  loadSpots() {
    this.isLoading = true;

    // Unsubscribe from previous subscription if it exists
    if (this.spotsSubscription) {
      this.spotsSubscription.unsubscribe();
    }

    // Create new subscription - sort by userRatingsTotal (ascending) to show hidden gems first
    this.spotsSubscription = this.firestore
      .collection('tourist_spots')
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (data) => {
          console.log('Loaded spots:', data.length, 'spots'); // Debug log

          // Sort by userRatingsTotal (ascending) - least popular first (hidden gems)
          this.originalSpots = this.sortByUserRatings(data);

          this.applyFilter(); // filter based on current tag
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading tourist spots:', err);
          this.isLoading = false;
        },
      });
  }
  async loadBucketList() {
    try {
      this.bucketList = await this.bucketService.getBucket();
    } catch (error) {
      console.error('Error loading bucket list:', error);
      this.bucketList = [];
    }
  }
  isInBucketList(spotId: string): boolean {
    return this.bucketList.some(s => s.id === spotId);
  }

async toggleBucketList(spot: any) {
  if (this.isInBucketList(spot.id)) {
    // Remove from bucket list
    await this.removeFromBucketList(spot.id);
    this.showRemovedAlert();
  } else {
    // Ask before adding
    const alert = await this.alertCtrl.create({
      header: 'Add to Bucket List',
      message: 'Do you want to add this to your bucket list?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes',
          handler: async () => {
            await this.addToBucketList(spot);
          }
        }
      ]
    });
    await alert.present();
  }
}

  async addToBucketList(spot: any) {
    try {
      await this.bucketService.addToBucket(spot);
      await this.loadBucketList(); // refresh UI
    } catch (error) {
      console.error('Error adding to bucket list:', error);
    }
  }

  async removeFromBucketList(spotId: string) {
    try {
      await this.bucketService.removeFromBucket(spotId);
      await this.loadBucketList(); // refresh UI
    } catch (error) {
      console.error('Error removing from bucket list:', error);
    }
  }

    private async showRemovedAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Removed',
      message: 'Removed from bucket list',
      buttons: ['OK']
    });
    await alert.present();
  }

  selectTag(tag: string): void {
    this.selectedTag = tag;
    this.currentPage = 1; // Reset to first page when changing filter
    this.applyFilter();
  }

  openSpotDetail(spotId: string) {
    this.navCtrl.navigateForward(`/tourist-spot-detail/${spotId}`);
  }
  applyFilter(): void {
    let filteredSpots: any[];

    if (this.selectedTag === 'All') {
      filteredSpots = this.originalSpots;
    } else {
      filteredSpots = this.originalSpots.filter(
        spot => spot.category?.toLowerCase() === this.selectedTag.toLowerCase()
      );
    }

    // Apply search filter if there's a search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredSpots = filteredSpots.filter(spot =>
        spot.name?.toLowerCase().includes(query) ||
        spot.description?.toLowerCase().includes(query) ||
        spot.category?.toLowerCase().includes(query)
      );
    }

    this.spots = filteredSpots;
    this.updatePagination();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.spots.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedSpots = this.spots.slice(startIndex, endIndex);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // Search methods
  onSearchInput(event: any): void {
    this.searchQuery = event.detail.value || '';
    this.currentPage = 1; // Reset to first page when searching
    this.applyFilter();
  }

  async openSearchModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SearchModalComponent,
      cssClass: 'search-modal',
      componentProps: {
        existingSpots: this.originalSpots
      }
    });

    await modal.present();

    const result = await modal.onDidDismiss();
    if (result.data && result.data.action === 'add') {
      await this.addTouristSpotToDatabase(result.data.place);
    }
  }



  async addTouristSpotToDatabase(googlePlace: any): Promise<void> {
    try {
      // Enhanced duplicate detection
      const isDuplicate = this.isDuplicateSpot(googlePlace);

      if (isDuplicate) {
        const toast = await this.toastCtrl.create({
          message: `"${googlePlace.name}" is already in our database!`,
          duration: 3000,
          color: 'warning',
          position: 'top',
          buttons: [
            {
              icon: 'information-circle',
              side: 'start'
            }
          ]
        });
        toast.present();
        return;
      }

      // Get place details for more information
      const placeDetails = await this.placesService.getPlaceDetails(googlePlace.place_id).toPromise();

      // Create new tourist spot data for approval
      const newSpotData = {
        name: googlePlace.name,
        description: placeDetails.result?.formatted_address || googlePlace.formatted_address || 'A tourist spot in Cebu, Philippines',
        category: this.determineCategory(googlePlace.types),
        location: {
          lat: googlePlace.geometry?.location?.lat || googlePlace.geometry?.viewport?.northeast?.lat,
          lng: googlePlace.geometry?.location?.lng || googlePlace.geometry?.viewport?.northeast?.lng
        },
        img: '', // Will be populated with Google Places photo if available
        googlePlaceId: googlePlace.place_id,
        rating: googlePlace.rating !== undefined ? googlePlace.rating : 0,
        userRatingsTotal: googlePlace.user_ratings_total !== undefined ? googlePlace.user_ratings_total : 0
      };

      // Try to get a photo for the spot
      try {
        const photoResult = await this.placesService.getPlacePhotos(googlePlace.place_id).toPromise();
        if (photoResult.result?.photos?.length > 0) {
          const photo = photoResult.result.photos[0];
          newSpotData.img = this.placesService.getPhotoUrl(photo.photo_reference);
        }
      } catch (photoError) {
        console.log('No photo available for this spot');
      }

      // Submit for approval instead of directly adding
      await this.pendingSpotService.submitForApproval(newSpotData);

      const toast = await this.toastCtrl.create({
        message: `"${googlePlace.name}" has been submitted for approval! We'll notify you once it's reviewed.`,
        duration: 4000,
        color: 'success',
        position: 'top',
        buttons: [
          {
            icon: 'checkmark-circle',
            side: 'start'
          }
        ]
      });
      toast.present();

    } catch (error) {
      console.error('Error submitting tourist spot for approval:', error);
      this.showAlert('Error', 'Failed to submit tourist spot for approval. Please try again.');

      // Reset search state on error
      this.searchResults = [];
      this.isSearching = false;
    }
  }

  private isDuplicateSpot(googlePlace: any): boolean {
    if (!this.originalSpots || this.originalSpots.length === 0) {
      return false;
    }

    const placeName = googlePlace.name?.toLowerCase().trim();
    if (!placeName) return false;

    // Check for exact match
    const exactMatch = this.originalSpots.find(spot =>
      spot.name?.toLowerCase().trim() === placeName
    );
    if (exactMatch) return true;

    // Check for partial matches (one name contains the other)
    const partialMatch = this.originalSpots.find(spot => {
      const existingName = spot.name?.toLowerCase().trim();
      if (!existingName) return false;

      // Check if one name contains the other (for variations like "SM Seaside" vs "SM Seaside City Cebu")
      return placeName.includes(existingName) || existingName.includes(placeName);
    });

    if (partialMatch) return true;

    // Check for similar names (common words match)
    const placeWords = placeName.split(' ').filter((word: string) => word.length > 2);
    const similarMatch = this.originalSpots.find(spot => {
      const existingName = spot.name?.toLowerCase().trim();
      if (!existingName) return false;

      const existingWords = existingName.split(' ').filter((word: string) => word.length > 2);

      // Check if they share significant words
      const commonWords = placeWords.filter((word: string) => existingWords.includes(word));
      return commonWords.length >= Math.min(2, Math.min(placeWords.length, existingWords.length));
    });

    return !!similarMatch;
  }

  private sortByUserRatings(spots: any[]): any[] {
    return spots.sort((a, b) => {
      // Get userRatingsTotal values, defaulting to 0 if undefined
      const aRatings = a.userRatingsTotal || 0;
      const bRatings = b.userRatingsTotal || 0;

      // Sort ascending (least popular first - hidden gems)
      return aRatings - bRatings;
    });
  }

  private determineCategory(types: string[]): string {
    if (!types || types.length === 0) return 'attraction';

    const typeMap: { [key: string]: string } = {
      'shopping_mall': 'mall',
      'amusement_park': 'attraction',
      'aquarium': 'attraction',
      'art_gallery': 'museum',
      'museum': 'museum',
      'park': 'park',
      'natural_feature': 'attraction',
      'tourist_attraction': 'attraction',
      'point_of_interest': 'attraction',
      'establishment': 'attraction'
    };

    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }

    return 'attraction';
  }

  async addToTrip(spot: any) {
    try {
      await this.bucketService.addToBucket(spot);

      // Update bucket status after adding
      await this.loadBucketStatus();

      // Show success notification
      const toast = await this.toastCtrl.create({
        message: `${spot.name} added to bucket list!`,
        duration: 2000,
        color: 'success',
        position: 'top',
        buttons: [
          {
            icon: 'checkmark-circle',
            side: 'start'
          }
        ]
      });
      toast.present();
    } catch (error) {
      console.error('Error adding to bucket list:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to add to bucket list. Please try again.',
        duration: 2000,
        color: 'danger',
        position: 'top'
      });
      toast.present();
    }
  }

  isInBucket(spotId: string): boolean {
    return this.bucketSpotIds.includes(spotId);
  }

  async logout() {
    await this.authService.logoutUser();
  }

  async loadVisitedSpots() {
    if (!this.userId) return;

    const snapshot = await this.firestore
      .collection(`users/${this.userId}/visitedSpots`, ref => ref.orderBy('visitedAt', 'desc'))
      .get()
      .toPromise();

    this.visitedSpots = snapshot?.docs.map(doc => doc.data()) || [];
  }

  goToHome() {
    this.navCtrl.navigateForward('/home');
  }

  // Manual refresh method to force reload data
  async refreshData() {
    console.log('Manually refreshing data...');
    this.loadSpots();
    await this.loadBucketStatus();
    await this.loadVisitedSpots();
  }

  // Handle pull-to-refresh
  async handleRefresh(event: any) {
    console.log('Pull to refresh triggered');
    await this.refreshData();
    event.target.complete();
  }

  // Debug method to check current data
  debugCurrentData() {
    console.log('=== DEBUG: Current Data ===');
    console.log('Original spots count:', this.originalSpots?.length);
    console.log('Filtered spots count:', this.spots?.length);
    console.log('Paginated spots count:', this.paginatedSpots?.length);
    console.log('Current filter:', this.selectedTag);
    console.log('Search query:', this.searchQuery);

    // Show first 5 spots with their userRatingsTotal for debugging
    console.log('First 5 spots (sorted by userRatingsTotal ascending):');
    this.originalSpots?.slice(0, 5).forEach((spot, index) => {
      console.log(`${index + 1}. ${spot.name} - Ratings: ${spot.userRatingsTotal || 0}`);
    });

    console.log('==========================');
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  ngOnDestroy() {
    // Clean up subscriptions when component is destroyed
    if (this.spotsSubscription) {
      this.spotsSubscription.unsubscribe();
    }
  }
  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }
  checkNetworkStatus() {
    if (!navigator.onLine) {
      this.showOfflineAlert();
    }
  }

  showOfflineAlert = async () => {
    const alert = await this.alertCtrl.create({
      header: 'No Internet Connection',
      message: 'You are currently offline. Some features may not be available. You can still access your itineraries on the map and calendar.',
      buttons: ['OK']
    });
    await alert.present();
  };

  showOnlineToast = async () => {
    const toast = await this.toastCtrl.create({
      message: 'You are back online!',
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    toast.present();
  };


}

