import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, ModalController } from '@ionic/angular';
import { ItineraryModalComponent } from './itinerary-modal.component';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';

@Component({
  selector: 'app-bucket-list',
  templateUrl: './bucket-list.page.html',
  styleUrls: ['./bucket-list.page.scss'],
  standalone: false,
})
export class BucketListPage implements OnInit {
  spots: any[] = [];
  itinerary: ItineraryDay[] = [];
  showSetupModal = false;
  showCustomDays = false;
  setup = { days: 1, startTime: '1970-01-01T08:00', endTime: '1970-01-01T18:00' };
  editing = false;
  isLoading = true;

  constructor(
    private bucketService: BucketService,
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private itineraryService: ItineraryService
  ) { }

  async ngOnInit() {
    await this.loadBucketList();
  }

  async ionViewWillEnter() {
    await this.loadBucketList();
  }

  async loadBucketList() {
    this.isLoading = true;
    try {
      this.spots = await this.bucketService.getBucket();
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading bucket list:', error);
      this.isLoading = false;
      this.showAlert('Error', 'Failed to load bucket list. Please try again.');
    }
  }

  async remove(spotId: string) {
    try {
      await this.bucketService.removeFromBucket(spotId);
      // Reload the bucket list to update the UI
      await this.loadBucketList();
    } catch (error) {
      console.error('Error removing spot:', error);
      this.showAlert('Error', 'Failed to remove spot from bucket list.');
    }
  }

  async clear() {
    try {
      await this.bucketService.clearBucket();
      // Reload the bucket list to update the UI
      await this.loadBucketList();
    } catch (error) {
      console.error('Error clearing bucket list:', error);
      this.showAlert('Error', 'Failed to clear bucket list.');
    }
  }
  
  async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);
    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }

  openItinerarySetup() {
    if (this.spots.length === 0) {
      this.showAlert('Empty Bucket List', 'Please add some tourist spots to your bucket list first!');
      return;
    }
    this.setup = { days: 1, startTime: '1970-01-01T08:00', endTime: '1970-01-01T18:00' };
    this.showSetupModal = true;
  }

  async confirmItinerarySetup() {
    if (!this.setup.days || this.setup.days < 1 || this.setup.days > 14) {
      this.showAlert('Invalid Input', 'Please enter a number between 1 and 14 days.');
      return;
    }
    if (!this.setup.startTime || !this.setup.endTime) {
      this.showAlert('Invalid Input', 'Please select start and end time.');
      return;
    }
    this.showSetupModal = false;
    // Extract HH:mm from ISO string
    const startTime = this.setup.startTime.substring(11, 16);
    const endTime = this.setup.endTime.substring(11, 16);
    await this.generateItinerary(this.setup.days, startTime, endTime);
  }

  async generateItinerary(days: number, startTime: string, endTime: string) {
    if (this.spots.length === 0) {
      this.showAlert('Empty Bucket List', 'Please add some tourist spots first!');
      return;
    }
    // Use the new itinerary service with full spot objects
    this.itinerary = await this.itineraryService.generateItinerary(this.spots, days, startTime, endTime);
    this.editing = false;
    this.showItinerary();
  }

  async showItinerary() {
    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: this.itinerary,
        editable: true,
        onEdit: () => this.editItinerary()
      },
      cssClass: 'itinerary-modal'
    });
    await modal.present();
  }

  async editItinerary() {
    // For simplicity, just allow re-running the setup for now
    // (Advanced: implement drag-and-drop, day assignment, duration editing)
    this.showSetupModal = true;
  }

  getTimeDisplay(timeString: string): string {
    if (!timeString) return 'Not set';
    // Extract time from ISO string (e.g., "1970-01-01T08:00" -> "8:00 AM")
    const time = timeString.substring(11, 16);
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
