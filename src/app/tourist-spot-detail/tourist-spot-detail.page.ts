import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, ToastController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PlacesImageService } from '../services/places-image.service';
import { GeofencingService } from '../services/geofencing.service';
import { BucketService } from '../services/bucket-list.service';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { LocalTipsService } from '../services/local-tips.service';
import { CalendarService, GlobalEvent } from '../services/calendar.service';

@Component({
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
  standalone: false,
})
export class TouristSpotDetailPage implements OnInit, OnDestroy {
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
  isInBucket = false;
  bucketStatusLoading = false;
  plannerActionLoading = false;
  hasVisitedSpot = false;
  private visitStatusSub?: Subscription;
  private geofenceVisitedSub?: Subscription;
  localTips: any[] = [];
  localTipText = '';
  isSubmittingLocalTip = false;
  
  // Image refresh properties
  isRefreshingImages = false;
  enhancedSpot: any = null;

  upcomingSpotEvents: GlobalEvent[] = [];
  spotEventsLoading = true;
  private spotEventsSub?: Subscription;

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
    private bucketService: BucketService,
    private itineraryPlannerService: ItineraryPlannerService,
    private localTipsService: LocalTipsService,
    private calendarService: CalendarService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit() {
    this.spotId = this.route.snapshot.paramMap.get('id');
    if (this.spotId) {
      this.loadSpot();
      this.loadReviews();
      this.loadApprovedLocalTips();
      this.loadUpcomingSpotEvents();
      this.observeVisitStatus();
      this.geofenceVisitedSub = this.geofencingService.visitedSpots$.subscribe(() => {
        this.cdr.markForCheck();
      });
    }
    this.reviewForm = this.fb.group({
      name: ['', Validators.required],
      comment: ['', Validators.required],
    });
  }

  ngOnDestroy(): void {
    this.visitStatusSub?.unsubscribe();
    this.geofenceVisitedSub?.unsubscribe();
    this.spotEventsSub?.unsubscribe();
  }

  loadUpcomingSpotEvents(): void {
    if (!this.spotId) {
      this.spotEventsLoading = false;
      return;
    }
    this.spotEventsSub?.unsubscribe();
    this.spotEventsLoading = true;
    this.spotEventsSub = this.calendarService.watchUpcomingEventsForTouristSpot(this.spotId).subscribe({
      next: (list) => {
        this.upcomingSpotEvents = list;
        this.spotEventsLoading = false;
      },
      error: () => {
        this.upcomingSpotEvents = [];
        this.spotEventsLoading = false;
      },
    });
  }

  formatSpotEventWhen(ev: GlobalEvent): string {
    const d = new Date(ev.date);
    const dateStr = isNaN(d.getTime())
      ? ev.date
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    if (ev.endTime?.trim()) {
      return `${dateStr} · ${ev.time} – ${ev.endTime}`;
    }
    return `${dateStr} · ${ev.time}`;
  }

  loadSpot() {
    this.firestore.collection('tourist_spots').doc(this.spotId!).valueChanges().subscribe(async data => {
      this.spotData = data ? { id: this.spotId, ...data } : null;
      if (this.spotId) {
        await this.checkBucketStatus();
        await this.refreshPlannerCache();
      }
      if (data) {
        this.enhanceSpotWithGoogleImages();
      }
    });
  }

  private enhanceSpotWithGoogleImages() {
    if (!this.spotData) return;
    
    this.placesImageService.enhanceTouristSpot(this.spotData).subscribe({
      next: (enhancedSpot) => {
        this.enhancedSpot = enhancedSpot;
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

  loadApprovedLocalTips() {
    if (!this.spotId) return;
    this.localTipsService.getApprovedTipsForSpot(this.spotId).subscribe({
      next: (tips) => {
        this.localTips = tips || [];
      },
      error: () => {
        this.localTips = [];
      }
    });
  }

  async submitLocalTip(): Promise<void> {
    if (!this.spotId || !this.spotData?.name) {
      this.showAlert('Error', 'Tourist spot data not available.');
      return;
    }

    if (!this.hasVisited()) {
      this.showAlert('Tips Locked', 'You need to visit this spot before submitting local tips.');
      return;
    }

    if (!this.localTipText.trim()) {
      this.showAlert('Validation', 'Please enter a local tip.');
      return;
    }

    this.isSubmittingLocalTip = true;
    try {
      await this.localTipsService.submitTip(this.spotId, this.spotData.name, this.localTipText);
      this.localTipText = '';
      this.showAlert('Submitted', 'Your local tip is pending admin review.');
    } catch (error: any) {
      this.showAlert('Error', error?.message || 'Failed to submit local tip.');
    } finally {
      this.isSubmittingLocalTip = false;
    }
  }

  async addReview() {
    if (!this.hasVisited()) {
      this.showAlert('Reviews Locked', 'You need to visit this spot before posting a review.');
      return;
    }

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
    if (!this.hasVisited()) {
      this.showAlert('Reviews Locked', 'You need to visit this spot before posting a review.');
      return;
    }

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

  async refreshImages() {
    if (!this.spotData || this.isRefreshingImages) return;
    
    this.isRefreshingImages = true;
    
    try {
      const loadingToast = await this.toastCtrl.create({
        message: `Refreshing images for ${this.spotData.name}...`,
        duration: 2000,
        position: 'bottom'
      });
      loadingToast.present();

      this.placesImageService.retryFetchImages(this.spotData).subscribe({
        next: async (enhancedSpot) => {
          this.enhancedSpot = enhancedSpot;

          const patch = this.placesImageService.getFirestoreUpdatePayload(enhancedSpot);

          if (!patch || Object.keys(patch).length === 0) {
            const noDataToast = await this.toastCtrl.create({
              message: `No Google Places data found for ${this.spotData.name}`,
              duration: 2500,
              color: 'warning',
              position: 'bottom'
            });
            noDataToast.present();
            return;
          }

          if (patch['img']) {
            this.spotData.img = patch['img'] as string;
          }
          if (patch['googlePlaceTypes']) {
            this.spotData.googlePlaceTypes = patch['googlePlaceTypes'];
          }
          if (patch['exposure']) {
            this.spotData.exposure = patch['exposure'];
          }
          if (patch['googlePlaceId']) {
            this.spotData.googlePlaceId = patch['googlePlaceId'];
          }

          try {
            await this.firestore.collection('tourist_spots').doc(this.spotId!).update(patch);

            let msg = `Updated ${this.spotData.name}`;
            if (patch['img']) {
              msg = `Images refreshed and spot metadata saved for ${this.spotData.name}!`;
            } else {
              msg = `Place details (types / exposure) saved for ${this.spotData.name}!`;
            }

            const successToast = await this.toastCtrl.create({
              message: msg,
              duration: 2200,
              color: 'success',
              position: 'bottom'
            });
            successToast.present();
          } catch (firestoreError) {
            console.error('Error updating Firestore document:', firestoreError);

            const errorToast = await this.toastCtrl.create({
              message: `Refresh completed but failed to save. Please try again.`,
              duration: 3000,
              color: 'warning',
              position: 'bottom'
            });
            errorToast.present();
          }
        },
        error: async (error) => {
          console.error('Error refreshing images:', error);
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

  hasGoogleImages(): boolean {
    return !!(this.enhancedSpot?.googleImages && this.enhancedSpot.googleImages.length > 0);
  }

  async toggleBucketList(): Promise<void> {
    if (!this.spotData || !this.spotId || this.bucketStatusLoading) return;

    this.bucketStatusLoading = true;
    try {
      if (this.isInBucket) {
        await this.bucketService.removeFromBucket(this.spotId);
        this.isInBucket = false;

        const toast = await this.toastCtrl.create({
          message: `${this.spotData.name} removed from your bucket list.`,
          duration: 2000,
          position: 'top',
          color: 'medium'
        });
        await toast.present();
      } else {
        await this.bucketService.addToBucket(this.spotData);
        this.isInBucket = true;

        const toast = await this.toastCtrl.create({
          message: `${this.spotData.name} added to your bucket list!`,
          duration: 2000,
          position: 'top',
          color: 'success'
        });
        await toast.present();
      }
    } catch (error) {
      console.error('Failed to toggle bucket list:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to update bucket list. Please try again.',
        duration: 2000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.bucketStatusLoading = false;
    }
  }

  private async checkBucketStatus(): Promise<void> {
    if (!this.spotId) return;
    try {
      this.isInBucket = await this.bucketService.isInBucket(this.spotId);
    } catch (error) {
      console.error('Failed to check bucket status:', error);
      this.isInBucket = false;
    }
  }

  private async refreshPlannerCache(): Promise<void> {
    try {
      await this.itineraryPlannerService.getPlannerSpots();
    } catch (error) {
      console.error('Failed to load itinerary planner state:', error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  isInItineraryPlanner(): boolean {
    return !!this.spotId && this.itineraryPlannerService.isInPlanner(this.spotId);
  }

  async plannerQuickAction(): Promise<void> {
    if (!this.spotData || !this.spotId || this.plannerActionLoading) {
      return;
    }

    const user = await this.afAuth.currentUser;
    if (!user) {
      const toast = await this.toastCtrl.create({
        message: 'Please sign in to use the itinerary planner.',
        duration: 2500,
        position: 'top',
        color: 'warning'
      });
      await toast.present();
      return;
    }

    this.plannerActionLoading = true;
    try {
      await this.itineraryPlannerService.getPlannerSpots();
      if (this.itineraryPlannerService.isInPlanner(this.spotId)) {
        await this.router.navigateByUrl('/itinerary-planner');
        return;
      }

      const added = await this.itineraryPlannerService.addSpotToPlanner(this.spotData);
      if (!added) {
        const toast = await this.toastCtrl.create({
          message: `${this.spotData.name} is already in your itinerary planner.`,
          duration: 2000,
          position: 'top',
          color: 'medium'
        });
        await toast.present();
        return;
      }

      const toast = await this.toastCtrl.create({
        message: `${this.spotData.name} added to your itinerary planner. Open the planner to arrange your days.`,
        duration: 3000,
        position: 'top',
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Failed to update itinerary planner:', error);
      const toast = await this.toastCtrl.create({
        message: 'Could not add to itinerary planner. Please try again.',
        duration: 2500,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.plannerActionLoading = false;
      this.cdr.markForCheck();
    }
  }

  canPostReview(): boolean {
    return this.hasVisited();
  }

  hasVisited(): boolean {
    if (!this.spotId) {
      return false;
    }
    return this.hasVisitedSpot || this.geofencingService.hasVisited(this.spotId);
  }

  private observeVisitStatus(): void {
    if (!this.spotId) {
      this.hasVisitedSpot = false;
      return;
    }

    this.visitStatusSub = this.afAuth.authState.pipe(
      switchMap(user => {
        if (!user) {
          return of(false);
        }

        const directDoc$ = this.firestore
          .doc(`users/${user.uid}/visitedSpots/${this.spotId}`)
          .valueChanges()
          .pipe(map(doc => !!doc));

        const spotIdQuery$ = this.firestore
          .collection(`users/${user.uid}/visitedSpots`, ref =>
            ref.where('spotId', '==', this.spotId).limit(1)
          )
          .valueChanges()
          .pipe(map(results => (results?.length ?? 0) > 0));

        const touristSpotIdQuery$ = this.firestore
          .collection(`users/${user.uid}/visitedSpots`, ref =>
            ref.where('touristSpotId', '==', this.spotId).limit(1)
          )
          .valueChanges()
          .pipe(map(results => (results?.length ?? 0) > 0));

        const allVisits$ = this.firestore
          .collection(`users/${user.uid}/visitedSpots`)
          .valueChanges({ idField: 'id' })
          .pipe(
            map(records =>
              (records || []).some((record: any) => {
                const recordId = record?.id;
                const spotId = record?.spotId;
                const touristSpotId = record?.touristSpotId;
                return recordId === this.spotId || spotId === this.spotId || touristSpotId === this.spotId;
              })
            )
          );

        return combineLatest([directDoc$, spotIdQuery$, touristSpotIdQuery$, allVisits$]).pipe(
          map(matches => matches.some(Boolean))
        );
      })
    ).subscribe(hasVisitedRemote => {
      this.hasVisitedSpot = hasVisitedRemote;
    });
  }
}
