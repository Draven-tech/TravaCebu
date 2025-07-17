import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

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

  rating: number = 5;
  comment: string = '';

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  ngOnInit() {
    this.spotId = this.route.snapshot.paramMap.get('id');
    if (this.spotId) {
      this.loadSpot();
      this.loadReviews();
    }
  }

  loadSpot() {
    this.firestore.collection('tourist_spots').doc(this.spotId!).valueChanges().subscribe(data => {
      this.spotData = data;
    });
  }

  loadReviews() {
    this.firestore.collection(`tourist_spots/${this.spotId}/reviews`, ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges()
      .subscribe(data => {
        this.reviews = data;
      });
  }

  async addReview() {
    const user = await this.afAuth.currentUser;
    if (!user || !this.spotId) return;

    const newReview = {
      userId: user.uid,
      username: user.displayName || 'Anonymous',
      rating: this.rating,
      comment: this.comment,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await this.firestore.collection(`tourist_spots/${this.spotId}/reviews`).add(newReview);
    this.rating = 5;
    this.comment = '';
    this.loadReviews(); // refresh
  }
}
