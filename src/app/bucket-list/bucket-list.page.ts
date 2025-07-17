import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-bucket-list',
  templateUrl: './bucket-list.page.html',
  styleUrls: ['./bucket-list.page.scss'],
  standalone: false,
})
export class BucketListPage implements OnInit {
  spots: any[] = [];

  constructor(
    private bucketService: BucketService,
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController
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

  async promptItineraryDays() {
    const alert = await this.alertCtrl.create({
      header: 'Generate Itinerary',
      message: 'How many days will you stay?',
      inputs: [
        {
          name: 'days',
          type: 'number',
          min: 1,
          placeholder: 'Enter number of days'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Generate',
          handler: (data) => {
            const days = parseInt(data.days, 10);
            if (days > 0) {
              this.generateItinerary(days);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  generateItinerary(days: number) {
    // TODO: Implement itinerary generation logic
    console.log('Generating itinerary for', days, 'days');
  }
}
