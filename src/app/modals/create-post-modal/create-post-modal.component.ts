import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { ModalController, AlertController, LoadingController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { StorageService } from '../../services/storage.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BadgeService } from '../../services/badge.service';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-create-post-modal',
  templateUrl: './create-post-modal.component.html',
  styleUrls: ['./create-post-modal.component.scss'],
  standalone: false,
})
export class CreatePostModalComponent {
  @Input() userId: string = '';
  @Input() userData: any = null;
  @Input() post: any = null;
  @Input() isEditing: boolean = false;

  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  postContent: string = '';
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  uploading: boolean = false;
  selectedSpotId: string = '';
  touristSpots: any[] = [];
  loadingSpots: boolean = false;

  // Itinerary sharing properties
  postType: 'regular' | 'shared_itinerary' = 'regular';
  selectedItineraryId: string = '';
  completedItineraries: any[] = [];
  loadingItineraries: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private firestore: AngularFirestore,
    private storageService: StorageService,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private badgeService: BadgeService,
    private calendarService: CalendarService
  ) {
    this.loadTouristSpots();
    this.loadCompletedItineraries();
    if (this.isEditing && this.post) {
      this.postContent = this.post.content || '';
      this.imagePreview = this.post.imageUrl || null;
      this.selectedSpotId = this.post.touristSpotId || '';
      this.postType = this.post.postType || 'regular';
      this.selectedItineraryId = this.post.sharedItinerary?.itineraryId || '';
    }
  }

  async loadTouristSpots() {
    this.loadingSpots = true;
    try {
      this.firestore.collection('tourist_spots', ref => ref.orderBy('name'))
        .valueChanges({ idField: 'id' })
        .subscribe((spots: any[]) => {
          this.touristSpots = spots;
          this.loadingSpots = false;
        });
    } catch (error) {
      console.error('Error loading tourist spots:', error);
      this.loadingSpots = false;
    }
  }

  async loadCompletedItineraries() {
    this.loadingItineraries = true;
    try {
      this.completedItineraries = await this.calendarService.loadCompletedItinerariesForSharing();
      this.loadingItineraries = false;
    } catch (error) {
      console.error('Error loading completed itineraries:', error);
      this.loadingItineraries = false;
    }
  }

  getSelectedSpot() {
    return this.touristSpots.find(spot => spot.id === this.selectedSpotId);
  }

  getSelectedItinerary() {
    return this.completedItineraries.find(itinerary => itinerary.id === this.selectedItineraryId);
  }

  selectImage() {
    this.imageInput.nativeElement.click();
  }

  onImageSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedImage = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  async createPost() {
    if (!this.postContent.trim() && !this.selectedImage && !this.imagePreview) {
      this.showAlert('Error', 'Please add some content or an image to your post');
      return;
    }

    // Validate itinerary sharing
    if (this.postType === 'shared_itinerary' && !this.selectedItineraryId) {
      this.showAlert('Error', 'Please select an itinerary to share');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.isEditing ? 'Updating post...' : 'Creating post...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const currentUser = await this.afAuth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      let imageUrl = this.imagePreview; // Use existing image if editing

      // Upload new image if selected
      if (this.selectedImage) {
        const filePath = `posts/${currentUser.uid}_${Date.now()}_${this.selectedImage.name}`;
        imageUrl = await this.storageService.uploadFile(filePath, this.selectedImage);
      }

      const selectedSpot = this.getSelectedSpot();
      const selectedItinerary = this.getSelectedItinerary();
      
      const postData: any = {
        userId: currentUser.uid,
        userName: this.userData?.fullName || 'Anonymous',
        userPhotoURL: this.userData?.photoURL || 'assets/img/default.png',
        content: this.postContent.trim(),
        imageUrl: imageUrl || null,
        likes: [],
        comments: [],
        timestamp: new Date(),
        isPublic: true,
        postType: this.postType
      };

      // Add tourist spot data only if provided and not empty
      if (this.selectedSpotId && selectedSpot) {
        postData.touristSpotId = this.selectedSpotId;
        postData.touristSpotName = selectedSpot.name || null;
        postData.touristSpotLocation = selectedSpot.location || null;
      }

      // Add shared itinerary data if sharing itinerary
      if (this.postType === 'shared_itinerary' && selectedItinerary && selectedItinerary.spots) {
        postData.sharedItinerary = {
          itineraryId: selectedItinerary.id || null,
          itineraryName: selectedItinerary.name || null,
          itineraryDate: selectedItinerary.date || null,
          spots: selectedItinerary.spots || [],
          totalSpots: selectedItinerary.spots ? selectedItinerary.spots.length : 0
        };
      }

      // Remove any undefined values to prevent Firestore errors
      const cleanedPostData = this.removeUndefinedValues(postData);

      if (this.isEditing && this.post?.id) {
        // Update existing post - create update object with only defined fields
        const updateData: any = {
          content: cleanedPostData.content,
          imageUrl: cleanedPostData.imageUrl,
          postType: cleanedPostData.postType
        };
        
        // Add optional fields only if they exist
        if (cleanedPostData.touristSpotId) {
          updateData.touristSpotId = cleanedPostData.touristSpotId;
          updateData.touristSpotName = cleanedPostData.touristSpotName;
          updateData.touristSpotLocation = cleanedPostData.touristSpotLocation;
        }
        
        if (cleanedPostData.sharedItinerary) {
          updateData.sharedItinerary = cleanedPostData.sharedItinerary;
        }
        
        await this.firestore.collection('posts').doc(this.post.id).update(updateData);
      } else {
        // Create new post
        await this.firestore.collection('posts').add(cleanedPostData);
      }

      await loading.dismiss();
      await this.modalCtrl.dismiss({ success: true });
      
      // Evaluate badges if post contains an image
      if (imageUrl && imageUrl !== this.imagePreview) {
        try {
          // Get current user data for badge evaluation
          const userDoc = await this.firestore.collection('users').doc(currentUser.uid).get().toPromise();
          const userData = userDoc?.data();
          
          if (userData) {
            await this.badgeService.evaluatePhotoEnthusiastBadge(currentUser.uid, userData);
          }
        } catch (error) {
          console.error('Error evaluating photo enthusiast badge:', error);
        }
      }
      
      // Evaluate social butterfly badge for any post creation
      try {
        // Get current user data for badge evaluation
        const userDoc = await this.firestore.collection('users').doc(currentUser.uid).get().toPromise();
        const userData = userDoc?.data();
        
        if (userData) {
          await this.badgeService.evaluateSocialButterflyBadge(currentUser.uid, userData);
        }
      } catch (error) {
        console.error('Error evaluating social butterfly badge:', error);
      }

      this.showAlert('Success', this.isEditing ? 'Post updated successfully!' : 'Post created successfully!');

    } catch (error: any) {
      console.error('Error creating post:', error);
      await loading.dismiss();
      this.showAlert('Error', `Failed to create post: ${error.message || error}`);
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
          cleaned[key] = this.removeUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}
