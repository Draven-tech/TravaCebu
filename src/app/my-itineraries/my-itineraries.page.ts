import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { NavController, AlertController, ModalController, ToastController } from '@ionic/angular';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { ViewItineraryModalComponent } from '../modals/view-itinerary-modal/view-itinerary-modal.component';
import { ItineraryModalComponent } from '../components/itinerary-modal/itinerary-modal.component';
import { PdfExportService } from '../services/pdf-export.service';
import { Clipboard } from '@capacitor/clipboard';
import { ActivatedRoute } from '@angular/router';
import { BudgetService } from '../services/budget.service';

@Component({
  selector: 'app-my-itineraries',
  templateUrl: './my-itineraries.page.html',
  styleUrls: ['./my-itineraries.page.scss'],
  standalone: false,
})
export class MyItinerariesPage implements OnInit {
  itineraries: any[] = [];
  isLoading = true;
  userId: string | null = null;
  downloadUrl: string = '';

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private calendarService: CalendarService,
    private pdfExportService: PdfExportService,
    private budgetService: BudgetService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) { }

  async ngOnInit() {
    const user = await this.afAuth.currentUser;
    this.userId = user?.uid || null;
    await this.loadItineraries();
    const itineraryId = this.route.snapshot.paramMap.get('id');
    if (itineraryId) {
      this.firestore
        .collection('user_itinerary_events', ref => ref.where('id', '==', itineraryId))
        .get()
        .subscribe(snapshot => {
        });
    }
  }

  async ionViewWillEnter() {
    await this.loadItineraries();
  }

  async loadItineraries() {

    try {
      this.isLoading = true;

      if (!this.userId) {
        this.itineraries = [];
        return;
      }

      const events = await this.calendarService.forceRefreshFromFirestore();

      if (events && events.length > 0) {
        events.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

        this.itineraries = this.groupEventsIntoItineraries(events);
      } else {
        this.itineraries = [];
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading itineraries:', error);
      this.showToast('Error loading itineraries', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private groupEventsIntoItineraries(events: CalendarEvent[]): any[] {
    const itineraries: any[] = [];
    const groupedEvents = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      const date = event.start.split('T')[0];
      if (!groupedEvents.has(date)) {
        groupedEvents.set(date, []);
      }
      groupedEvents.get(date)!.push(event);
    });

    groupedEvents.forEach((dayEvents, date) => {
      if (dayEvents.length > 0) {
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        const firstEvent = dayEvents[0];
        const lastEvent = dayEvents[dayEvents.length - 1];

        let startTime = firstEvent.start;
        let endTime = lastEvent.end;

        const itinerary = {
          id: `itinerary_${date}`,
          title: `Itinerary for ${this.getDateDisplay(date)}`,
          start: startTime,
          end: endTime,
          date: date,
          status: firstEvent.status || 'active',
          spotsCount: dayEvents.filter(e => e.extendedProps?.type === 'tourist_spot').length,
          days: 1,
          events: dayEvents,
          createdAt: firstEvent.createdAt
        };

        itineraries.push(itinerary);
      }
    });

    return itineraries.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }

  async viewItinerary(itinerary: any) {
    const itineraryDays = this.convertToItineraryDays(itinerary);

    const modal = await this.modalCtrl.create({
      component: ViewItineraryModalComponent,
      componentProps: {
        itinerary: itineraryDays
      },
      cssClass: 'view-itinerary-modal'
    });

    await modal.present();
  }

  async editItinerary(itinerary: any) {
    let originalSpots: any[] = [];
    try {
      const touristSpotsSnapshot = await this.firestore
        .collection('tourist_spots')
        .get()
        .toPromise();

      if (touristSpotsSnapshot) {
        originalSpots = touristSpotsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...(data as any)
          };
        });
      }
    } catch (error) {
      console.error('Error loading tourist spots for editing:', error);
      originalSpots = [];
    }

    const itineraryDays = this.convertToItineraryDays(itinerary, originalSpots);

    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: itineraryDays,
        originalSpots: originalSpots,
        isEditMode: true
      },
      cssClass: 'itinerary-modal'
    });

    await modal.present();

    const result = await modal.onDidDismiss();
    if (result.data && result.data.saved) {
      this.showToast('Itinerary updated successfully!', 'success');
    }
  }

  async toggleStatus(itinerary: any) {
    try {
      const newStatus = itinerary.status === 'completed' ? 'active' : 'completed';
      const batch = this.firestore.firestore.batch();

      itinerary.events.forEach((event: any) => {
        const eventRef = this.firestore.collection('user_itinerary_events').doc(event.id).ref;
        batch.update(eventRef, { status: newStatus });
      });

      await batch.commit();

      if (newStatus === 'completed') {
        await this.ensureCompletedItineraryExpenses(itinerary);
      }

      await this.loadItineraries();

      this.showToast(
        `Itinerary marked as ${newStatus === 'completed' ? 'completed' : 'active'}!`,
        'success'
      );
    } catch (error) {
      console.error('Error updating itinerary status:', error);
      this.showToast('Error updating status', 'danger');
    }
  }

  private async ensureCompletedItineraryExpenses(itinerary: any): Promise<void> {
    const itineraryId = itinerary?.id || (itinerary?.date ? `itinerary_${itinerary.date}` : '');
    const itineraryDate = itinerary?.date || this.getLocalDateString(itinerary?.start) || this.getLocalDateString(new Date());

    if (!itineraryId || !itineraryDate) {
      return;
    }

    const existingExpenses = await this.budgetService.getExpenses();
    const existingForItinerary = existingExpenses.filter(expense =>
      expense.itineraryId === itineraryId || this.getLocalDateString(expense.date) === itineraryDate
    );

    if (existingForItinerary.length > 0) {
      return;
    }

    const limits = this.budgetService.getCurrentBudgetLimits();
    const events = itinerary?.events || [];

    const rideCount = events.filter((event: any) => event?.extendedProps?.type === 'tourist_spot').length;
    const mealCount = events.filter((event: any) => event?.extendedProps?.type === 'restaurant').length;
    const hotelCount = events.filter((event: any) => event?.extendedProps?.type === 'hotel').length;

    const transportationEstimate = Math.max(0, Math.round(rideCount * 13));
    const foodEstimate = Math.max(0, Math.round(mealCount > 0 ? mealCount * (limits.dailyFood / 2) : 0));
    const accommodationEstimate = Math.max(0, Math.round(hotelCount > 0 ? hotelCount * limits.dailyAccommodation : 0));

    if (transportationEstimate > 0) {
      await this.budgetService.addTransportationExpense(
        transportationEstimate,
        `Estimated transportation for ${itinerary.title || itinerary.date}`,
        undefined,
        itineraryId,
        1
      );
    }

    if (foodEstimate > 0) {
      await this.budgetService.addFoodExpense(
        foodEstimate,
        'Estimated Meals',
        'Food',
        itineraryId,
        1
      );
    }

    if (accommodationEstimate > 0) {
      await this.budgetService.addAccommodationExpense(
        accommodationEstimate,
        'Estimated Accommodation',
        Math.max(1, hotelCount),
        itineraryId,
        1
      );
    }
  }

  private getLocalDateString(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      const datePart = value.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async deleteItinerary(itinerary: any) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Itinerary',
      message: 'Are you sure you want to delete this itinerary? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const eventsWithIds = itinerary.events.filter((event: any) => event.id && event.id.length > 0);

              if (eventsWithIds.length > 0) {
                const batch = this.firestore.firestore.batch();

                eventsWithIds.forEach((event: any) => {
                  const eventRef = this.firestore.collection('user_itinerary_events').doc(event.id).ref;
                  batch.delete(eventRef);
                });

                await batch.commit();
              }

              const currentEvents = JSON.parse(localStorage.getItem('user_itinerary_events') || '[]');
              const updatedEvents = currentEvents.filter((event: any) => {
                const eventDate = event.start?.split('T')[0];
                return eventDate !== itinerary.date;
              });

              localStorage.setItem('user_itinerary_events', JSON.stringify(updatedEvents));

              await this.loadItineraries();

              this.showToast('Itinerary deleted successfully!', 'success');
            } catch (error) {
              console.error('Error deleting itinerary:', error);

              try {
                await this.calendarService.clearItineraryEvents();
                await this.loadItineraries();
                this.showToast('Itinerary cleared successfully!', 'success');
              } catch (fallbackError) {
                console.error('Fallback delete also failed:', fallbackError);
                this.showToast('Error deleting itinerary', 'danger');
              }
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private convertToItineraryDays(itinerary: any, originalSpots: any[] = []): any[] {
    const dayEvents = itinerary.events || [];
    const spots = dayEvents.filter((event: any) => event?.extendedProps?.type === 'tourist_spot');

    const restaurants = dayEvents.filter((event: any) => event?.extendedProps?.type === 'restaurant');
    const hotels = dayEvents.filter((event: any) => event?.extendedProps?.type === 'hotel');

    const chosenHotel = hotels.find((hotel: any) => hotel?.extendedProps?.isChosen) || null;

    return [{
      day: 1,
      date: itinerary.date,
      spots: spots.map((event: any) => {

        const originalSpot = originalSpots.find(spot => spot.name === event.title);

        return {
          id: event.extendedProps?.spotId || event.id || '',
          name: event.title || 'Unknown Spot',
          description: event.extendedProps?.description || originalSpot?.description || '',
          category: event.extendedProps?.category || originalSpot?.category || 'GENERAL',
          timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
          estimatedDuration: event.extendedProps?.duration || '2 hours',
          durationMinutes: event.extendedProps?.durationMinutes || 120,
          location: event.extendedProps?.location || originalSpot?.location || { lat: 0, lng: 0 },
          img: originalSpot?.img || event.extendedProps?.img || 'assets/img/default.png',
          mealType: event.extendedProps?.mealType || null,
          chosenRestaurant: event.extendedProps?.restaurant ? {
            name: event.extendedProps.restaurant,
            rating: event.extendedProps.restaurantRating,
            vicinity: event.extendedProps.restaurantVicinity
          } : null
        };
      }),
      routes: [], // Add empty routes array to prevent filter errors
      restaurants: restaurants.map((event: any) => ({
        id: event.id || '',
        name: event.title || 'Unknown Restaurant',
        description: event.extendedProps?.description || '',
        category: event.extendedProps?.category || 'RESTAURANT',
        timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '12:00',
        estimatedDuration: event.extendedProps?.duration || '1 hour',
        location: event.extendedProps?.location || { lat: 0, lng: 0 },
        mealType: event.extendedProps?.mealType || null,
        isChosen: event.extendedProps?.isChosen || false
      })),
      hotels: hotels.map((event: any) => ({
        id: event.id || '',
        name: event.title || 'Unknown Hotel',
        description: event.extendedProps?.description || '',
        category: event.extendedProps?.category || 'HOTEL',
        timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '15:00',
        estimatedDuration: event.extendedProps?.duration || '1 night',
        location: event.extendedProps?.location || { lat: 0, lng: 0 },
        isChosen: event.extendedProps?.isChosen || false
      })),
      chosenHotel: chosenHotel ? {
        id: chosenHotel.id || '',
        name: chosenHotel.title || 'Unknown Hotel',
        description: chosenHotel.extendedProps?.description || '',
        category: chosenHotel.extendedProps?.category || 'HOTEL',
        timeSlot: chosenHotel.start?.split('T')[1]?.substring(0, 5) || '15:00',
        estimatedDuration: chosenHotel.extendedProps?.duration || '1 night',
        location: chosenHotel.extendedProps?.location || { lat: 0, lng: 0 },
        rating: chosenHotel.extendedProps?.rating,
        vicinity: chosenHotel.extendedProps?.vicinity,
        isChosen: true
      } : null
    }];
  }

  goToBucketList() {
    this.navCtrl.navigateForward('/bucket-list');
  }

  getDateDisplay(dateString: string): string {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getTimeDisplay(dateTimeString: string): string {
    if (!dateTimeString) return 'Unknown time';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  async handleRefresh(event: any) {
    try {
      await this.loadItineraries();
      event.target.complete();
    } catch (error) {
      console.error('Error refreshing itineraries:', error);
      event.target.complete();
    }
  }

  // Manual refresh method that can be called programmatically
  async forceRefresh() {
    await this.loadItineraries();
  }

  // Manual refresh method for the refresh button
  async manualRefresh() {
    this.showToast('Refreshing itineraries...', 'primary');
    await this.loadItineraries();
    this.showToast('Itineraries refreshed!', 'success');
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  async copyToClipboard(text: string) {
    await Clipboard.write({ string: text });
    this.presentToast('Link copied to clipboard!');
  }

async shareUrl() {
  try {
    this.showToast('Generating PDF, please wait...', 'primary');
    const url = await this.pdfExportService.generateAndUploadPDF(this.itineraries);
    this.downloadUrl = url;
    await Clipboard.write({ string: url });
    this.showToast('PDF link copied to clipboard!', 'success');
  } catch (err) {
    console.error('PDF generation failed:', err);
    this.showToast('Failed to generate PDF link.', 'danger');
  }
}
  async downloadPdf() {
  await this.pdfExportService.generateAndSavePDF(this.itineraries);
}

}
