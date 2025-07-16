import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
  standalone: false,
})
export class TouristSpotDetailPage implements OnInit {
  spotId: string = '';
  spotData: any;

  constructor(
    private route: ActivatedRoute,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    this.spotId = this.route.snapshot.paramMap.get('id') || '';
    if (this.spotId) {
      this.firestore.collection('tourist_spots').doc(this.spotId).valueChanges().subscribe(data => {
        this.spotData = data;
      });
    }
  }
}
