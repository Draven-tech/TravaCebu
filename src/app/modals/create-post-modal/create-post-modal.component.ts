import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { ModalController, AlertController, LoadingController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { StorageService } from '../../services/storage.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';

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

  constructor(
    private modalCtrl: ModalController,
    private firestore: AngularFirestore,
    private storageService: StorageService,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {
    this.loadTouristSpots();
    if (this.isEditing && this.post) {
      this.postContent = this.post.content || '';
      this.imagePreview = this.post.imageUrl || null;
      this.selectedSpotId = this.post.touristSpotId || '';
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

  getSelectedSpot() {
    return this.touristSpots.find(spot => spot.id === this.selectedSpotId);
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
      const postData = {
        userId: currentUser.uid,
        userName: this.userData?.fullName || 'Anonymous',
        userPhotoURL: this.userData?.photoURL || 'assets/img/default.png',
        content: this.postContent.trim(),
        imageUrl: imageUrl,
        touristSpotId: this.selectedSpotId || null,
        touristSpotName: selectedSpot?.name || null,
        touristSpotLocation: selectedSpot?.location || null,
        likes: [],
        comments: [],
        timestamp: new Date(),
        isPublic: true
      };

      console.log('Creating post with data:', postData);

      if (this.isEditing && this.post?.id) {
        // Update existing post
        await this.firestore.collection('posts').doc(this.post.id).update({
          content: postData.content,
          imageUrl: postData.imageUrl,
          touristSpotId: postData.touristSpotId,
          touristSpotName: postData.touristSpotName,
          touristSpotLocation: postData.touristSpotLocation
        });
      } else {
        // Create new post
        await this.firestore.collection('posts').add(postData);
      }

      await loading.dismiss();
      await this.modalCtrl.dismiss({ success: true });
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
} 