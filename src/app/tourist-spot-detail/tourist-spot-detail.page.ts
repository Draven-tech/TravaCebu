import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlacesImageService } from '../services/places-image.service';
import { GeofencingService } from '../services/geofencing.service';
import { BucketService } from '../services/bucket-list.service';

@Component({
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
  standalone: false,
})
export class TouristSpotDetailPage implements OnInit {
  spotId: string | null = null;
  spotData: any;
  reviews: any[] = [];
  postAsAnonymous = false;
  rating: number = 5;
  comment: string = '';
  selectedFile?: File;
  selectedFilePreview?: string;
  uploading = false;
  uploadProgress: number = 0;
  reviewForm!: FormGroup;
  imageUrl: string = '';
  
  // Image refresh properties
  isRefreshingImages = false;
  enhancedSpot: any = null;

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private storageService: StorageService,
    private fb: FormBuilder,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private placesImageService: PlacesImageService,
    private geofencingService: GeofencingService,
    private bucketService: BucketService
  ) { }

  ngOnInit() {
    this.spotId = this.route.snapshot.paramMap.get('id');
    if (this.spotId) {
      this.loadSpot();
      this.loadReviews();
    }
    this.reviewForm = this.fb.group({
      name: ['', Validators.required],
      comment: ['', Validators.required],
    });
  }

  loadSpot() {
    this.firestore.collection('tourist_spots').doc(this.spotId!).valueChanges().subscribe(data => {
      this.spotData = data;
      if (data) {
        // Try to enhance the spot with Google Places images
        this.enhanceSpotWithGoogleImages();
      }
    });
  }

  // Enhance spot with Google Places images
  private enhanceSpotWithGoogleImages() {
    if (!this.spotData) return;
    
    this.placesImageService.enhanceTouristSpot(this.spotData).subscribe({
      next: (enhancedSpot) => {
        this.enhancedSpot = enhancedSpot;
        // Update the spot data with Google images if available
        if (enhancedSpot.googleImages && enhancedSpot.googleImages.length > 0 && !this.spotData.img) {
          this.spotData.img = enhancedSpot.googleImages[0].url;
        }
      },
      error: (error) => {
        console.error('Error enhancing spot with Google images:', error);
      }
    });
  }

  loadReviews() {
    this.firestore
      .collection(`tourist_spots/${this.spotId}/reviews`, ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe(data => {
        this.reviews = data;
      });
  }

  async addReview() {
    if (!this.comment.trim() || this.rating < 1 || this.rating > 5) {
      this.showAlert('Error', 'Please provide a rating and a comment.');
      return;
    }

    this.uploading = true;
    let photoUrl = '';

    try {
      if (this.selectedFile) {
        const filePath = `reviews/${Date.now()}_${this.selectedFile.name}`;
        photoUrl = await this.storageService.uploadFile(filePath, this.selectedFile);
      }

      const user = await this.afAuth.currentUser;
      const reviewData = {
        rating: this.rating,
        comment: this.comment,
        photoUrl,
        createdAt: new Date(),
        username: this.postAsAnonymous ? 'Anonymous' : (user?.displayName || user?.email || 'Anonymous')
      };

      await this.firestore
        .collection('tourist_spots')
        .doc(this.spotId!)
        .collection('reviews')
        .add(reviewData);

      this.comment = '';
      this.rating = 5;
      this.selectedFile = undefined;
      this.selectedFilePreview = undefined;

      this.loadReviews();
      this.showAlert('Success', 'Review submitted successfully!');

    } catch (error) {
      console.error('Failed to submit review:', error);
      this.showAlert('Error', 'Something went wrong while submitting your review.');
    } finally {
      this.uploading = false;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => this.selectedFilePreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedFile = undefined;
    this.selectedFilePreview = '';
  }

  private async uploadImage(): Promise<string> {
    if (!this.selectedFile) return '';

    this.uploading = true;
    this.uploadProgress = 0;
    const filePath = `reviews/${Date.now()}_${this.selectedFile.name}`;

    try {
      const url = await this.storageService.uploadFile(filePath, this.selectedFile);
      return url;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    } finally {
      this.uploading = false;
      this.uploadProgress = 100;
    }
  }

  async submitReview() {
    if (this.reviewForm.invalid) {
      this.showAlert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const imageUrl = await this.uploadImage();
      const { name, comment } = this.reviewForm.value;

      const reviewData: any = {
        name,
        comment,
        img: imageUrl,
        createdAt: new Date(),
        rating: this.rating
      };

      await this.firestore
        .collection('tourist_spots')
        .doc(this.spotId!)
        .collection('reviews')
        .add(reviewData);

      this.showAlert('Success', 'Review submitted successfully');
      this.reviewForm.reset();
      this.removeImage();
      this.rating = 5;
      this.postAsAnonymous = false;

    } catch (error) {
      console.error('Error uploading review:', error);
      this.showAlert('Error', 'Failed to upload review');
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  // Refresh images from Google Places
  async refreshImages() {
    if (!this.spotData || this.isRefreshingImages) return;
    
    this.isRefreshingImages = true;
    
    try {
      // Show loading toast
      const loadingToast = await this.toastCtrl.create({
        message: `Refreshing images for ${this.spotData.name}...`,
        duration: 2000,
        position: 'bottom'
      });
      loadingToast.present();

      // Try to enhance the spot with fresh Google Places images
      this.placesImageService.retryFetchImages(this.spotData).subscribe({
        next: async (enhancedSpot) => {
          this.enhancedSpot = enhancedSpot;
          
          // Update the spot data with new image if available
          if (enhancedSpot.googleImages && enhancedSpot.googleImages.length > 0) {
            const newImageUrl = enhancedSpot.googleImages[0].url;
            this.spotData.img = newImageUrl;
            
            // Update the Firestore document with the new image
            try {
              await this.firestore.collection('tourist_spots').doc(this.spotId!).update({
                img: newImageUrl
              });
              
              // Show success toast
              const successToast = await this.toastCtrl.create({
                message: `Images refreshed and saved for ${this.spotData.name}!`,
                duration: 2000,
                color: 'success',
                position: 'bottom'
              });
              successToast.present();
              
            } catch (firestoreError) {
              console.error('Error updating Firestore document:', firestoreError);
              
              // Show error toast for Firestore update failure
              const errorToast = await this.toastCtrl.create({
                message: `Image refreshed but failed to save. Please try again.`,
                duration: 3000,
                color: 'warning',
                position: 'bottom'
              });
              errorToast.present();
            }
          } else {
            // Show no images found toast
            const noImagesToast = await this.toastCtrl.create({
              message: `No new images found for ${this.spotData.name}`,
              duration: 2000,
              color: 'warning',
              position: 'bottom'
            });
            noImagesToast.present();
          }
        },
        error: async (error) => {
          console.error('Error refreshing images:', error);
          
          // Show error toast
          const errorToast = await this.toastCtrl.create({
            message: `Failed to refresh images for ${this.spotData.name}`,
            duration: 3000,
            color: 'danger',
            position: 'bottom'
          });
          errorToast.present();
        },
        complete: () => {
          this.isRefreshingImages = false;
        }
      });
    } catch (error) {
      console.error('Error refreshing spot images:', error);
      this.isRefreshingImages = false;
    }
  }

  // Check if spot has Google Places data
  hasGoogleImages(): boolean {
    return !!(this.enhancedSpot?.googleImages && this.enhancedSpot.googleImages.length > 0);
  }

  // Geofencing and visit tracking methods

  /**
   * Check if user has visited this spot
   */
  hasVisited(): boolean {
    return this.geofencingService.hasVisited(this.spotId || '');
  }

  /**
   * Mark spot as visited (manual fallback)
   */
  async markAsVisited(): Promise<void> {
    if (!this.spotData || !this.spotId) return;

    try {
      const fakeGeofenceSpot = {
        id: this.spotId,
        name: this.spotData.name,
        latitude: this.spotData.location?.lat || 0,
        longitude: this.spotData.location?.lng || 0,
        radius: 100
      };

      await this.geofencingService.manuallyConfirmVisit(fakeGeofenceSpot);

      const toast = await this.toastCtrl.create({
        message: `✅ Marked ${this.spotData.name} as visited! You can now post reviews.`,
        duration: 3000,
        position: 'top',
        color: 'success'
      });
      await toast.present();

    } catch (error) {
      console.error('Failed to mark as visited:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to mark as visited. Please try again.',
        duration: 2000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    }
  }

  /**
   * Add spot to bucket list
   */
  async addToBucketList(): Promise<void> {
    if (!this.spotData || !this.spotId) return;

    try {
      await this.bucketService.addToBucket(this.spotData);
      
      const toast = await this.toastCtrl.create({
        message: `${this.spotData.name} added to your bucket list!`,
        duration: 2000,
        position: 'top',
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Failed to add to bucket list:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to add to bucket list. Please try again.',
        duration: 2000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    }
  }

  /**
   * Check if reviews should be allowed
   */
  canPostReview(): boolean {
    return this.hasVisited();
  }
}
