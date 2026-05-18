import { Component, OnInit } from '@angular/core';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { NavController } from '@ionic/angular';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { ItineraryModalComponent } from '../components/itinerary-modal/itinerary-modal.component';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { CalendarService } from '../services/calendar.service';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-itinerary-planner',
  templateUrl: './itinerary-planner.page.html',
  styleUrls: ['./itinerary-planner.page.scss'],
  standalone: false
})
export class ItineraryPlannerPage implements OnInit {

  spots: any[] = [];

  itineraries: any[] = [];

  itinerary: ItineraryDay[] = [];

  showSetupModal = false;
  defaultNamePlaceholder = 'Itinerary 1';

  setup = {
    itineraryName: '',
    days: 1,
    startDate: this.getTodayString(),
    startTime: '1970-01-01T08:00',
    endTime: '1970-01-01T18:00'
  };

  editing = false;
  currentItineraryId: string | null = null;

  isLoading = true;
  proceeding = false;

  constructor(
    private itineraryplannerService: ItineraryPlannerService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService,
    private afAuth: AngularFireAuth
  ) { }

  trackBySpotId(_index: number, spot: { id?: string }): string {
    return spot?.id ?? '';
  }

  trackByItineraryId(_index: number, itinerary: { id?: string }): string {
    return itinerary?.id ?? String(_index);
  }

  trackBySavedSpotId(_index: number, spot: { spotId?: string }): string {
    return spot?.spotId ?? String(_index);
  }

  truncate(text: string | undefined, max: number): string {
    if (!text) return '';
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1)).replace(/\s+$/, '')}…`;
  }

  locationLine(spot: any): string | undefined {
    const name = spot?.location_name;
    if (typeof name === 'string' && name.trim()) {
      return this.truncate(name.trim(), 72);
    }
    const loc = spot?.location;
    if (typeof loc === 'string' && loc.trim()) {
      return this.truncate(loc.trim(), 72);
    }
    return undefined;
  }

  async handleRefresh(event: any) {
    await this.loadPageData();
    event?.target?.complete?.();
  }

  async loadItineraries() {
    try {
      this.itineraries = await this.itineraryplannerService.getItineraries();
    } catch (error) {
      console.error(error);
      this.showAlert('Error', 'Failed to load itineraries.');
    }
  }

  async loadPageData() {
    this.isLoading = true;
    try {
      await this.loadItineraries();
      await this.loadPlannerSpots();
    } finally {
      this.isLoading = false;
    }
  }

  async ngOnInit() {
    await this.loadPageData();
  }

  async loadPlannerSpots() {
    this.spots = await this.itineraryplannerService.getPlannerSpots();
  }

  private async savePlannerSpotsToStorage(): Promise<void> {
    await this.itineraryplannerService.setPlannerSpots(this.spots);
  }

  async ionViewWillEnter() {
    await this.loadPageData();
  }

  async removeFromPlanner(spotId: string) {
    this.spots = this.spots.filter(s => s.id !== spotId);
    await this.savePlannerSpotsToStorage();
  }

  async clearPlanner() {
    this.spots = [];
    await this.savePlannerSpotsToStorage();
  }

  async confirmClearPlanner() {
    if (this.spots.length === 0) return;
    const alert = await this.alertCtrl.create({
      header: 'Clear planner?',
      message: 'All spots will be removed from the planner. Saved itineraries are not deleted.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear all',
          role: 'destructive',
          handler: () => this.clearPlanner()
        }
      ]
    });
    await alert.present();
  }

  async removeFromSaved(itineraryId: string, spotId: string) {
    await this.itineraryplannerService.removeSpotFromItinerary(itineraryId, spotId);
    await this.loadItineraries();
  }

  async clearSaved(itineraryId: string) {
    await this.itineraryplannerService.clearSpotsFromItinerary(itineraryId);
    await this.loadItineraries();
  }

  async deleteItinerary(itineraryId: string) {
    await this.itineraryplannerService.deleteItinerary(itineraryId);
    await this.loadItineraries();
  }

  async loadItineraryToPlanner(itinerary: any) {
    this.spots = itinerary.spots || [];
    this.setup.itineraryName = itinerary.name;
    this.setup.days = itinerary.days || 1;
    this.setup.startDate = itinerary.startDate;

    this.editing = true;
    this.currentItineraryId = itinerary.id;
    await this.savePlannerSpotsToStorage();
  }

  async openItinerarySetup() {
    if (this.spots.length === 0) {
      this.showAlert('Empty', 'Add spots first!');
      return;
    }

    this.defaultNamePlaceholder =
      await this.calendarService.getNextDefaultItineraryName();

    this.showSetupModal = true;
  }

  onDaysChange(event: any) {
    const raw = event?.detail?.value ?? event;
    const val = typeof raw === 'object' && raw !== null ? (raw.value ?? raw.lower ?? 1) : raw;
    this.setup.days = Math.max(1, Math.min(14, +val || 1));
  }

  async confirmItinerarySetup() {
    if (this.proceeding) return;
    this.proceeding = true;
    this.showSetupModal = false;

    const loading = await this.loadingCtrl.create({
      message: 'Building your itinerary…',
      spinner: 'crescent',
      cssClass: 'tc-loading-overlay',
      backdropDismiss: false,
    });
    await loading.present();

    try {
      const days = Math.max(1, Math.min(14, Number(this.setup.days) || 1));
      await this.generateItinerary(
        days,
        this.setup.startTime,
        this.setup.endTime,
        this.setup.startDate
      );
    } finally {
      await loading.dismiss();
      this.proceeding = false;
    }
  }

  async generateItinerary(days: number, startTime: string, endTime: string, startDate: string) {
    const start = startTime.substring(11, 16);
    const end = endTime.substring(11, 16);

    this.itinerary = await this.itineraryService.generateItinerary(
      this.spots,
      days,
      start,
      end,
      startDate
    );

    this.showItinerary();
  }

  async saveItinerary() {
    const name =
      this.setup.itineraryName.trim() ||
      (await this.calendarService.getNextDefaultItineraryName());

    if (this.editing && this.currentItineraryId) {
      for (const spot of this.spots) {
        await this.itineraryplannerService.addSpotToItinerary(
          this.currentItineraryId,
          spot,
          spot.day || 1
        );
      }
    } else {
      const id = await this.itineraryplannerService.createItinerary({
        name,
        startDate: this.setup.startDate,
        days: this.setup.days
      });

      for (const spot of this.spots) {
        await this.itineraryplannerService.addSpotToItinerary(
          id,
          spot,
          spot.day || 1
        );
      }
    }

    await this.clearPlanner();
    this.editing = false;
    this.currentItineraryId = null;

    await this.loadItineraries();
  }

  async showItinerary() {
    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: this.itinerary,
        editable: true,
        onEdit: () => this.editItinerary(),
        originalSpots: this.spots,
        itineraryName: this.setup.itineraryName,
        onNameChange: (name: string) => {
          this.setup.itineraryName = name;
        },

        onSave: () => this.saveItinerary()
      }
    });

    await modal.present();
  }

  async editItinerary() {
    this.showSetupModal = true;
  }

  getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  openSpotDetail(spotId: string) {
    this.navCtrl.navigateForward(`/tourist-spot-detail/${spotId}`);
  }

  async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);
    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }

  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
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

  getTimeDisplay(timeString: string): string {
    if (!timeString) return 'Not set';
    const time = timeString.substring(11, 16);
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
