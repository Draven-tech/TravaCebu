import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { NavController, AlertController, ModalController, ToastController } from '@ionic/angular';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { ViewItineraryModalComponent } from './view-itinerary-modal.component';
import { ItineraryModalComponent } from '../bucket-list/itinerary-modal.component';
import { PdfExportService } from '../services/pdf-export.service';

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

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private calendarService: CalendarService,
    private pdfExportService: PdfExportService
  ) {}

  async ngOnInit() {
    const user = await this.afAuth.currentUser;
    this.userId = user?.uid || null;
    await this.loadItineraries();
  }

  async loadItineraries() {
    try {
      this.isLoading = true;
      
      if (!this.userId) {
        this.itineraries = [];
        return;
      }

      // Use the calendar service to load events (this handles Firestore + localStorage fallback)
      const events = await this.calendarService.loadItineraryEvents();

      if (events && events.length > 0) {
        // Sort events by start date in descending order
        events.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

        // Group events into itineraries
        this.itineraries = this.groupEventsIntoItineraries(events);
      } else {
        this.itineraries = [];
      }
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
        
        // Use original time range if available, otherwise fall back to event times
        let startTime = firstEvent.start;
        let endTime = lastEvent.end;
        
        if (firstEvent.extendedProps?.originalStartTime && firstEvent.extendedProps?.originalEndTime) {
          // Use original time range but with the correct date
          const datePart = date; // YYYY-MM-DD
          const originalStartTimeOnly = firstEvent.extendedProps.originalStartTime.substring(11, 16); // HH:MM
          const originalEndTimeOnly = firstEvent.extendedProps.originalEndTime.substring(11, 16); // HH:MM
          
          startTime = `${datePart}T${originalStartTimeOnly}:00`;
          endTime = `${datePart}T${originalEndTimeOnly}:00`;
        }
        
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
    // Convert itinerary back to the format expected by ItineraryModalComponent for editing
    const itineraryDays = this.convertToItineraryDays(itinerary);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryModalComponent,
      componentProps: {
        itinerary: itineraryDays,
        isEditMode: true
      },
      cssClass: 'itinerary-modal'
    });
    
    await modal.present();
    
    // Handle the result when modal is dismissed
    const result = await modal.onDidDismiss();
    if (result.data && result.data.saved) {
      // Reload itineraries to get updated data
      await this.loadItineraries();
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
              // Check if events have proper Firestore IDs
              const eventsWithIds = itinerary.events.filter((event: any) => event.id && event.id.length > 0);
              
              if (eventsWithIds.length > 0) {
                // Delete events with proper IDs from Firestore
                const batch = this.firestore.firestore.batch();
                
                eventsWithIds.forEach((event: any) => {
                  const eventRef = this.firestore.collection('user_itinerary_events').doc(event.id).ref;
                  batch.delete(eventRef);
                });
                
                await batch.commit();
              }
              
              // Always clear from localStorage as well
              const currentEvents = JSON.parse(localStorage.getItem('user_itinerary_events') || '[]');
              const updatedEvents = currentEvents.filter((event: any) => {
                // Remove events that match this itinerary's date
                const eventDate = event.start?.split('T')[0];
                return eventDate !== itinerary.date;
              });
              
              localStorage.setItem('user_itinerary_events', JSON.stringify(updatedEvents));
              
              // Reload itineraries to get fresh data
              await this.loadItineraries();
              
              this.showToast('Itinerary deleted successfully!', 'success');
            } catch (error) {
              console.error('Error deleting itinerary:', error);
              
              // Fallback: Try using calendar service to clear events
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

  private convertToItineraryDays(itinerary: any): any[] {
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
      spots: spots.map((event: any) => ({
        id: event.id || '',
        name: event.title || 'Unknown Spot',
        description: event.extendedProps?.description || '',
        category: event.extendedProps?.category || 'GENERAL',
        timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
        estimatedDuration: event.extendedProps?.duration || '2 hours',
        location: event.extendedProps?.location || { lat: 0, lng: 0 },
        mealType: event.extendedProps?.mealType || null,
        chosenRestaurant: event.extendedProps?.restaurant ? {
          name: event.extendedProps.restaurant,
          rating: event.extendedProps.restaurantRating,
          vicinity: event.extendedProps.restaurantVicinity
        } : null
      })),
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

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  exportPDF(itinerary: any) {
  this.pdfExportService.generateItineraryPDF(itinerary);
}
} 