import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';


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

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private storageService: StorageService,
    private fb: FormBuilder,
    private alertCtrl: AlertController,

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
  
  async markAsVisited() {
  const user = await this.afAuth.currentUser;
  if (!user || !this.spotId || !this.spotData) {
    this.showAlert('Error', 'User not logged in or spot data missing.');
    return;
  }

  const visitedRef = this.firestore
    .collection('users')
    .doc(user.uid)
    .collection('visitedSpots')
    .doc(this.spotId);

  try {
    await visitedRef.set(
      {
        spotId: this.spotId,
        name: this.spotData.name || '',
        img: this.spotData.img || '',
        visitedAt: new Date(),
      },
      { merge: true }
    );

    this.showAlert('Success', 'Marked as visited!');
  } catch (error) {
    console.error('Error marking as visited:', error);
    this.showAlert('Error', 'Failed to mark as visited.');
  }
}
}
