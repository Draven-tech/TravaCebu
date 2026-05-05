import { Component, OnInit } from '@angular/core';
import { ItineraryPlannerService } from '../services/itinerary-planner.service';
import { NavController } from '@ionic/angular';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { ItineraryModalComponent } from '../components/itinerary-modal/itinerary-modal.component';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { CalendarService } from '../services/calendar.service';

@Component({
  selector: 'app-itinerary-planner',
  templateUrl: './itinerary-planner.page.html',
  styleUrls: ['./itinerary-planner.page.scss'],
  standalone: false
})
export class ItineraryPlannerPage implements OnInit {

  // 🟡 PLANNER (DRAFT)
  spots: any[] = [];

  // 🔵 SAVED ITINERARIES
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

  isLoading = false;

  constructor(
    private itineraryplannerService: ItineraryPlannerService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService
  ) { }

  // 🔵 LOAD SAVED ITINERARIES
  async loadItineraries() {
    this.isLoading = true;
    try {
      this.itineraries = await this.itineraryplannerService.getItineraries();
    } catch (error) {
      console.error(error);
      this.showAlert('Error', 'Failed to load itineraries.');
    } finally {
      this.isLoading = false;
    }
  }

  async ngOnInit() {
    await this.loadItineraries();
    await this.loadPlannerSpots();
  }
  async loadPlannerSpots() {
    this.spots = await this.itineraryplannerService.getPlannerSpots();
  }

  /** Keeps planner draft spots in Firestore for cross-screen sync. */
  private async savePlannerSpotsToStorage(): Promise<void> {
    await this.itineraryplannerService.setPlannerSpots(this.spots);
  }

  async ionViewWillEnter() {
    await this.loadItineraries();
    await this.loadPlannerSpots();
  }

  // =============================
  // 🟡 PLANNER ACTIONS (DRAFT)
  // =============================

  async removeFromPlanner(spotId: string) {
    this.spots = this.spots.filter(s => s.id !== spotId);
    await this.savePlannerSpotsToStorage();
  }

  async clearPlanner() {
    this.spots = [];
    await this.savePlannerSpotsToStorage();
  }

  // =============================
  // 🔵 SAVED ACTIONS
  // =============================

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

  // ✏️ LOAD INTO PLANNER (EDIT MODE)
  async loadItineraryToPlanner(itinerary: any) {
    this.spots = itinerary.spots || [];
    this.setup.itineraryName = itinerary.name;
    this.setup.days = itinerary.days || 1;
    this.setup.startDate = itinerary.startDate;

    this.editing = true;
    this.currentItineraryId = itinerary.id;
    await this.savePlannerSpotsToStorage();
  }

  // =============================
  // 🚀 GENERATION
  // =============================

  async openItinerarySetup() {
    if (this.spots.length === 0) {
      this.showAlert('Empty', 'Add spots first!');
      return;
    }

    this.defaultNamePlaceholder =
      await this.calendarService.getNextDefaultItineraryName();

    this.showSetupModal = true;
  }

  async confirmItinerarySetup() {
    this.showSetupModal = false;

    await this.generateItinerary(
      this.setup.days,
      this.setup.startTime,
      this.setup.endTime,
      this.setup.startDate
    );
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

  // 💾 SAVE (CREATE OR UPDATE)
  async saveItinerary() {
    const name =
      this.setup.itineraryName.trim() ||
      (await this.calendarService.getNextDefaultItineraryName());

    if (this.editing && this.currentItineraryId) {
      // UPDATE EXISTING
      for (let spot of this.spots) {
        await this.itineraryplannerService.addSpotToItinerary(
          this.currentItineraryId,
          spot,
          spot.day || 1
        );
      }
    } else {
      // CREATE NEW
      const id = await this.itineraryplannerService.createItinerary({
        name,
        startDate: this.setup.startDate,
        days: this.setup.days
      });

      for (let spot of this.spots) {
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

      // IMPORTANT: pass current name
      itineraryName: this.setup.itineraryName,

      // FIX: capture updated name
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

  // =============================
  // UTIL
  // =============================

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