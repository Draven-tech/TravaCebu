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
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) { }

  isOnline(): boolean {
    return navigator.onLine;
  }

  async showOfflineAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Offline mode',
      message: 'You need to go online first to make changes to your itinerary.',
      buttons: ['OK']
    });

    await alert.present();
  }
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
          // Process and display the itinerary
        });
    }
  }


  async ionViewWillEnter() {
    // Refresh data when the page becomes visible
    // This ensures we get the latest data after editing an itinerary
    await this.loadItineraries();
  }

  async loadItineraries() {

    try {
      this.isLoading = true;

      if (!this.userId) {
        this.itineraries = [];
        return;
      }

      // Force refresh from Firestore to ensure we get the latest data
      const events = await this.calendarService.forceRefreshFromFirestore();

      if (events && events.length > 0) {
        // Sort events by start date in descending order
        events.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

        // Group events into itineraries
        this.itineraries = this.groupEventsIntoItineraries(events);
      } else {
        this.itineraries = [];
      }

      // Force change detection after loading
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

    // Group events by date
    events.forEach(event => {
      const date = event.start.split('T')[0]; // Get just the date part
      if (!groupedEvents.has(date)) {
        groupedEvents.set(date, []);
      }
      groupedEvents.get(date)!.push(event);
    });

    // Convert grouped events to itineraries
    groupedEvents.forEach((dayEvents, date) => {
      if (dayEvents.length > 0) {
        // Sort events by start time to get proper time range
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        const firstEvent = dayEvents[0];
        const lastEvent = dayEvents[dayEvents.length - 1];

        // Use the actual event times (which reflect the current date)
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
    // Convert itinerary back to the format expected by ViewItineraryModalComponent
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
    // Load all tourist spots from the main collection (same as user dashboard)
    // This ensures we have all possible spots to choose from
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

    // Convert itinerary back to the format expected by ItineraryModalComponent for editing
    const itineraryDays = this.convertToItineraryDays(itinerary, originalSpots);

    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: itineraryDays,
        originalSpots: originalSpots, // Pass the full bucket list as available spots
        isEditMode: true
      },
      cssClass: 'itinerary-modal'
    });

    await modal.present();

    // Handle the result when modal is dismissed
    const result = await modal.onDidDismiss();
    if (result.data && result.data.saved) {
      this.showToast('Itinerary updated successfully!', 'success');
    }
  }

  async toggleStatus(itinerary: any) {
    try {
      const newStatus = itinerary.status === 'completed' ? 'active' : 'completed';

      // Update all events in this itinerary
      const batch = this.firestore.firestore.batch();

      itinerary.events.forEach((event: any) => {
        const eventRef = this.firestore.collection('user_itinerary_events').doc(event.id).ref;
        batch.update(eventRef, { status: newStatus });
      });

      await batch.commit();

      // Reload itineraries to get fresh data
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

  async deleteItinerary(itinerary: any) {
    if (!this.isOnline()) {
      await this.showOfflineAlert();
      return;
    }

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
              const user = await this.afAuth.currentUser;

              if (!user) {
                this.showToast('Login required.', 'danger');
                return;
              }

              const snapshot = await this.firestore
                .collection('user_itinerary_events', ref =>
                  ref.where('userId', '==', user.uid)
                )
                .get()
                .toPromise();

              if (!snapshot || snapshot.empty) {
                this.showToast('No deletable events found.', 'warning');
                return;
              }

              const batch = this.firestore.firestore.batch();

              snapshot.docs.forEach(doc => {
                const data = doc.data() as any;

                // match itinerary timeframe
                if (
                  data.start >= itinerary.start &&
                  data.end <= itinerary.end
                ) {
                  batch.delete(doc.ref);
                }
              });

              await batch.commit();

              await this.loadItineraries();
              this.showToast('Deleted successfully.', 'success');

            } catch (err) {
              console.error(err);
              this.showToast('Delete failed.', 'danger');
            }
          }

        }
      ]
    });

    await alert.present();
  }

  private convertToItineraryDays(itinerary: any, originalSpots: any[] = []): any[] {
    // This is a simplified conversion - you might need to adjust based on your actual data structure
    const dayEvents = itinerary.events || [];
    const spots = dayEvents.filter((event: any) => event?.extendedProps?.type === 'tourist_spot');

    // Extract restaurants and hotels from events
    const restaurants = dayEvents.filter((event: any) => event?.extendedProps?.type === 'restaurant');
    const hotels = dayEvents.filter((event: any) => event?.extendedProps?.type === 'hotel');

    // Find chosen hotel for this day
    const chosenHotel = hotels.find((hotel: any) => hotel?.extendedProps?.isChosen) || null;

    return [{
      day: 1,
      date: itinerary.date,
      spots: spots.map((event: any) => {
        // Try to find the original spot data to get proper image
        const originalSpot = originalSpots.find(spot => spot.name === event.title);

        return {
          id: event.extendedProps?.spotId || event.id || '', // Use spotId from extendedProps if available
          name: event.title || 'Unknown Spot',
          description: event.extendedProps?.description || originalSpot?.description || '',
          category: event.extendedProps?.category || originalSpot?.category || 'GENERAL',
          timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
          estimatedDuration: event.extendedProps?.duration || '2 hours',
          durationMinutes: event.extendedProps?.durationMinutes || 120,
          location: event.extendedProps?.location || originalSpot?.location || { lat: 0, lng: 0 },
          img: originalSpot?.img || event.extendedProps?.img || 'assets/img/default.png', // Use original spot image if available
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
