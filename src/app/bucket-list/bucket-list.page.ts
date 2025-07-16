import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-bucket-list',
  templateUrl: './bucket-list.page.html',
  styleUrls: ['./bucket-list.page.scss'],
  standalone: false,
})
export class BucketListPage implements OnInit {
  spots: any[] = [];

  constructor(private bucketService: BucketService,
    private navCtrl: NavController,
    private afAuth: AngularFireAuth
  ) { }

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
  async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);

    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }
}
