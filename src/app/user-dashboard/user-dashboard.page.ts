import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BucketService } from '../services/bucket-list.service';
import { NavController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { PlacesService } from '../services/places.service';
import { StorageService } from '../services/storage.service';

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
    private storageService: StorageService
  ) { }

  async ngOnInit() {
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
    // Load tourist spots
    this.firestore.collection('tourist_spots').valueChanges({ idField: 'id' }).subscribe(spots => {
      this.spots = spots;
      this.originalSpots = spots;
      this.isLoading = false;
      this.applyFilter();
    });
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
    this.isSearching = true;
    this.searchResults = [];
    
    const alert = await this.alertCtrl.create({
      header: 'Search Tourist Spots',
      message: 'Enter the name of a tourist spot in Cebu to search for it.',
      inputs: [
        {
          name: 'searchTerm',
          type: 'text',
          placeholder: 'e.g., SM Seaside, Magellan\'s Cross, etc.'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            this.isSearching = false;
          }
        },
        {
          text: 'Search',
          handler: async (data) => {
            if (data.searchTerm?.trim()) {
              await this.searchTouristSpots(data.searchTerm.trim());
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async searchTouristSpots(searchTerm: string): Promise<void> {
    this.isSearching = true;
    this.searchResults = [];

    try {
      // Search using Google Places API
      const searchResult = await this.placesService.searchPlaceByName(
        searchTerm,
        10.3157, // Cebu City latitude
        123.8854  // Cebu City longitude
      ).toPromise();

      if (searchResult.results && searchResult.results.length > 0) {
        this.searchResults = searchResult.results.slice(0, 5); // Limit to 5 results
        await this.showSearchResults(searchTerm);
      } else {
        this.showAlert('No Results', 'No tourist spots found with that name.');
      }
    } catch (error) {
      console.error('Error searching tourist spots:', error);
      this.showAlert('Error', 'Failed to search for tourist spots. Please try again.');
    } finally {
      this.isSearching = false;
    }
  }

  async showSearchResults(searchTerm: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Search Results for "${searchTerm}"`,
      message: 'Select a tourist spot to add to our database:',
      inputs: this.searchResults.map((result, index) => ({
        name: `result_${index}`,
        type: 'radio',
        label: `${result.name} - ${result.formatted_address || 'Cebu, Philippines'}`,
        value: index
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add Selected',
          handler: async (data) => {
            if (data !== undefined) {
              const selectedResult = this.searchResults[data];
              await this.addTouristSpotToDatabase(selectedResult);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async addTouristSpotToDatabase(googlePlace: any): Promise<void> {
    try {
      // Check if spot already exists in database
      const existingSpot = this.originalSpots.find(spot => 
        spot.name?.toLowerCase() === googlePlace.name?.toLowerCase()
      );

      if (existingSpot) {
        this.showAlert('Already Exists', 'This tourist spot is already in our database.');
        return;
      }

      // Get place details for more information
      const placeDetails = await this.placesService.getPlaceDetails(googlePlace.place_id).toPromise();
      
      // Create new tourist spot data
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
        rating: googlePlace.rating,
        userRatingsTotal: googlePlace.user_ratings_total,
        createdAt: new Date(),
        updatedAt: new Date()
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

      // Add to Firestore
      const docRef = await this.firestore.collection('tourist_spots').add(newSpotData);
      
      this.showAlert('Success', `"${googlePlace.name}" has been added to our database!`);
      
      // Refresh the spots list
      this.loadSpots();
      
    } catch (error) {
      console.error('Error adding tourist spot:', error);
      this.showAlert('Error', 'Failed to add tourist spot to database. Please try again.');
    }
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
    await this.authService.logout();
  }

  async loadVisitedSpots() {
    if (!this.userId) return;
    
    try {
      const visitedDoc = await this.firestore.collection('users').doc(this.userId).collection('visited_spots').get().toPromise();
      this.visitedSpots = visitedDoc?.docs.map(doc => doc.data()) || [];
    } catch (error) {
      console.error('Error loading visited spots:', error);
    }
  }

  goToHome() {
    this.navCtrl.navigateForward('/home');
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}

