import { Component, OnInit } from '@angular/core';
import { BucketService } from '../services/bucket-list.service';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { ItineraryModalComponent } from '../components/itinerary-modal/itinerary-modal.component';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { CalendarService } from '../services/calendar.service';

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
  defaultNamePlaceholder = 'Itinerary 1';
  setup = {
    itineraryName: '',
    days: 1,
    startDate: this.getTodayString(),
    startTime: '1970-01-01T08:00',
    endTime: '1970-01-01T18:00'
  };
  editing = false;
  isLoading = false;

  constructor(
    private bucketService: BucketService,
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService
  ) { }

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

  async ngOnInit() {
    await this.loadBucketList();
  }

  async ionViewWillEnter() {
    await this.loadBucketList();
  }

  async remove(spotId: string) {
    try {
      await this.bucketService.removeFromBucket(spotId);
      await this.loadBucketList();
    } catch (error) {
      console.error('Error removing spot:', error);
      this.showAlert('Error', 'Failed to remove spot from bucket list.');
    }
  }

  async clear() {
    try {
      await this.bucketService.clearBucket();
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
  openSpotDetail(spotId: string) {
    this.navCtrl.navigateForward(`/tourist-spot-detail/${spotId}`);
  }
  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }

  async openItinerarySetup() {
    if (this.spots.length === 0) {
      this.showAlert('Empty Bucket List', 'Please add tourist spots to your bucket list first!');
      return;
    }
    this.defaultNamePlaceholder = await this.calendarService.getNextDefaultItineraryName();
    this.setup = {
      itineraryName: '',
      days: 1,
      startDate: this.getTodayString(),
      startTime: '1970-01-01T08:00',
      endTime: '1970-01-01T18:00'
    };
    this.showSetupModal = true;
  }

  async confirmItinerarySetup() {
    if (!this.setup.days || this.setup.days < 1 || this.setup.days > 14) {
      this.showAlert('Invalid Input', 'Please enter a number between 1 and 14 days.');
      return;
    }
    if (!this.setup.startDate) {
      this.showAlert('Invalid Input', 'Please select a start date.');
      return;
    }
    if (!this.setup.startTime || !this.setup.endTime) {
      this.showAlert('Invalid Input', 'Please select start and end time.');
      return;
    }

    this.showSetupModal = false;


    await this.generateItinerary(this.setup.days, this.setup.startTime, this.setup.endTime, this.setup.startDate);
  }

  async generateItinerary(days: number, startTime: string, endTime: string, startDate: string) {
    if (this.spots.length === 0) {
      this.showAlert('Empty Bucket List', 'Please add some tourist spots first!');
      return;
    }
    const startTimeOnly = startTime.substring(11, 16);
    const endTimeOnly = endTime.substring(11, 16);
    this.itinerary = await this.itineraryService.generateItinerary(this.spots, days, startTimeOnly, endTimeOnly, startDate);
    this.editing = false;
    this.showItinerary();
  }

  async showItinerary() {
    const trimmed = (this.setup.itineraryName || '').trim();
    const itineraryName = trimmed || (await this.calendarService.getNextDefaultItineraryName());
    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: this.itinerary,
        itineraryName,
        originalStartTime: this.setup.startTime,
        originalEndTime: this.setup.endTime,
        editable: true,
        onEdit: () => this.editItinerary(),
        originalSpots: this.spots
      },
      cssClass: 'itinerary-modal'
    });
    await modal.present();
  }

  async editItinerary() {
    this.showSetupModal = true;
  }

  getTimeDisplay(timeString: string): string {
    if (!timeString) return 'Not set';
    const time = timeString.substring(11, 16);
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  getDateDisplay(dateString: string): string {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
