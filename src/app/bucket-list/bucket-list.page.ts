import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, ModalController } from '@ionic/angular';
import { ItineraryModalComponent } from './itinerary-modal.component';

@Component({
  selector: 'app-bucket-list',
  templateUrl: './bucket-list.page.html',
  styleUrls: ['./bucket-list.page.scss'],
  standalone: false,
})
export class BucketListPage implements OnInit {
  spots: any[] = [];
  itinerary: any[] = [];

  constructor(
    private bucketService: BucketService,
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
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
    if (this.spots.length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Empty Bucket List',
        message: 'Please add some tourist spots to your bucket list first!',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Generate Itinerary',
      message: 'How many days will you stay?',
      inputs: [
        {
          name: 'days',
          type: 'number',
          min: 1,
          max: 14,
          placeholder: 'Enter number of days (1-14)'
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
            if (days > 0 && days <= 14) {
              this.generateItinerary(days);
            } else {
              this.showAlert('Invalid Input', 'Please enter a number between 1 and 14 days.');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  generateItinerary(days: number) {
    if (this.spots.length === 0) {
      this.showAlert('Empty Bucket List', 'Please add some tourist spots first!');
      return;
    }

    // Create a copy of spots to work with
    const availableSpots = [...this.spots];
    this.itinerary = [];

    // Calculate spots per day
    const spotsPerDay = Math.ceil(availableSpots.length / days);

    for (let day = 1; day <= days; day++) {
      const daySpots = [];
      const spotsToAdd = Math.min(spotsPerDay, availableSpots.length);

      // Add spots for this day
      for (let i = 0; i < spotsToAdd; i++) {
        if (availableSpots.length > 0) {
          // Try to group spots by proximity (simple approach)
          const currentSpot = availableSpots.shift()!;
          daySpots.push({
            ...currentSpot,
            timeSlot: this.generateTimeSlot(i, spotsToAdd),
            estimatedDuration: this.getEstimatedDuration(currentSpot.category)
          });
        }
      }

      if (daySpots.length > 0) {
        this.itinerary.push({
          day: day,
          spots: daySpots,
          totalSpots: daySpots.length
        });
      }
    }

    // Show the itinerary
    this.showItinerary();
  }

  private generateTimeSlot(index: number, totalSpots: number): string {
    const startHour = 9; // Start at 9 AM
    const hoursPerSpot = Math.max(2, Math.floor(8 / totalSpots)); // At least 2 hours per spot
    const startTime = startHour + (index * hoursPerSpot);
    const endTime = startTime + hoursPerSpot;
    
    return `${startTime}:00 - ${endTime}:00`;
  }

  private getEstimatedDuration(category: string): string {
    const durations: { [key: string]: string } = {
      'attraction': '2-3 hours',
      'mall': '3-4 hours',
      'restaurant': '1-2 hours',
      'hotel': 'Overnight',
      'beach': '3-5 hours',
      'church': '1-2 hours',
      'museum': '2-3 hours',
      'park': '2-3 hours',
      'other': '2-3 hours'
    };
    
    return durations[category] || '2-3 hours';
  }

  private async showItinerary() {
    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: this.itinerary
      },
      cssClass: 'itinerary-modal'
    });
    await modal.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
