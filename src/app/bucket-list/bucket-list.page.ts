import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';

@Component({
  selector: 'app-bucket-list',
  templateUrl: './bucket-list.page.html',
  styleUrls: ['./bucket-list.page.scss'],
  standalone: false,
})
export class BucketListPage implements OnInit {
  spots: any[] = [];

  constructor(private bucketService: BucketService) {}

  ngOnInit() {
    this.spots = this.bucketService.getBucket();
  }

  remove(spotId: string) {
    this.bucketService.removeFromBucket(spotId);
    this.spots = this.bucketService.getBucket();
  }

  clear() {
    this.bucketService.clearBucket();
    this.spots = [];
  }
}
