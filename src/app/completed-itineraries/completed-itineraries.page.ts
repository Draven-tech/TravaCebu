import { Component, OnInit } from '@angular/core';
import { NavController, AlertController, ToastController, ModalController } from '@ionic/angular';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { BudgetService } from '../services/budget.service';
import { Subscription } from 'rxjs';
import { ViewItineraryModalComponent, ViewItinerarySpot, ViewItineraryDay } from '../modals/view-itinerary-modal/view-itinerary-modal.component';
import { Clipboard } from '@capacitor/clipboard';
import { PdfExportService} from '../services/pdf-export.service';

@Component({
  selector: 'app-completed-itineraries',
  templateUrl: './completed-itineraries.page.html',
  styleUrls: ['./completed-itineraries.page.scss'],
  standalone: false,
})
export class CompletedItinerariesPage implements OnInit {
  completedItineraries: any[] = [];
  isLoading = true;
    downloadUrl: string = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private navCtrl: NavController,
    private calendarService: CalendarService,
    private budgetService: BudgetService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private pdfExportService: PdfExportService,
  ) { }

  async ngOnInit() {
    await this.loadCompletedItineraries();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadCompletedItineraries() {
    this.isLoading = true;

    try {
      // Load ALL events (including completed) from calendar service
      const allEvents = await this.calendarService.loadAllItineraryEvents();
      const completedEvents = allEvents.filter(event => event.status === 'completed');

      // Group completed events into itineraries
      this.completedItineraries = this.groupEventsIntoItineraries(completedEvents);

      for (const itinerary of this.completedItineraries) {
        // Set default values first
        itinerary.totalExpenses = 0;
        itinerary.expenseBreakdown = {
          transportation: 0,
          food: 0,
          accommodation: 0
        };
        itinerary.expenses = [];

        // Try to load expenses
        try {
          await this.loadItineraryExpenses(itinerary);
        } catch (error) {
          // Silently skip expense loading if it fails
        }
      }

    } catch (error) {
      console.error('Error loading completed itineraries:', error);
      this.showToast('Failed to load completed itineraries', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private groupEventsIntoItineraries(events: CalendarEvent[]): any[] {
    const itineraries: any[] = [];
    const groupedEvents = new Map<string, CalendarEvent[]>();

    // Group events by date
    events.forEach(event => {
      const date = event.start.split('T')[0];
      if (!groupedEvents.has(date)) {
        groupedEvents.set(date, []);
      }
      groupedEvents.get(date)!.push(event);
    });

    // Convert grouped events to itineraries
    groupedEvents.forEach((dayEvents, date) => {
      if (dayEvents.length > 0) {
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        const itinerary = {
          id: `completed_itinerary_${date}`,
          originalItineraryId: `itinerary_${date}`,
          name: `Completed Trip - ${this.getDateDisplay(date)}`,
          date: date,
          completedDate: new Date(),
          totalExpenses: 0,
          expenseBreakdown: {
            transportation: 0,
            food: 0,
            accommodation: 0
          },
          days: [{
            day: 1,
            date: date,
            spots: dayEvents.map(event => ({
              name: event.title,
              type: event.extendedProps?.type || 'tourist_spot',
              timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
              duration: event.extendedProps?.duration || '2 hours',
              location: event.extendedProps?.location,
              restaurant: event.extendedProps?.restaurant,
              hotel: event.extendedProps?.hotel,
              rating: event.extendedProps?.rating,
              vicinity: event.extendedProps?.vicinity
            }))
          }]
        };

        itineraries.push(itinerary);
      }
    });

    return itineraries;
  }

  private async loadItineraryExpenses(itinerary: any) {
    try {
      // Get all expenses and filter manually since getBudgetSummary might not work with our ID format
      const allExpenses = await this.budgetService.getExpenses();
      const itineraryIdCandidates = this.getItineraryIdCandidates(itinerary);

      // Filter expenses that match this itinerary
      const matchingExpenses = allExpenses.filter(expense => {
        const matchesId = !!expense.itineraryId && itineraryIdCandidates.includes(expense.itineraryId);
        const matchesDate = this.getLocalDateString(expense.date) === itinerary.date;
        const matches = matchesId || matchesDate;

        return matches;
      });

      // Calculate totals manually
      let totalTransportation = 0;
      let totalFood = 0;
      let totalAccommodation = 0;

      matchingExpenses.forEach(expense => {
        switch (expense.category) {
          case 'transportation':
            totalTransportation += expense.amount;
            break;
          case 'food':
            totalFood += expense.amount;
            break;
          case 'accommodation':
            totalAccommodation += expense.amount;
            break;
        }
      });

      const totalExpenses = totalTransportation + totalFood + totalAccommodation;

      itinerary.totalExpenses = totalExpenses;
      itinerary.expenseBreakdown = {
        transportation: totalTransportation,
        food: totalFood,
        accommodation: totalAccommodation
      };
      itinerary.expenses = matchingExpenses;

    } catch (error) {
      console.error('Error loading expenses for itinerary:', error);
      // Set default values on error
      itinerary.totalExpenses = 0;
      itinerary.expenseBreakdown = {
        transportation: 0,
        food: 0,
        accommodation: 0
      };
      itinerary.expenses = [];
    }
  }

  getDateDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
 
async viewItinerary(completedItinerary: any) {
  // Convert the completed itinerary to the format expected by ViewItineraryModalComponent
  const itineraryDays = this.convertToViewItineraryFormat(completedItinerary);
  
  const modal = await this.modalCtrl.create({
    component: ViewItineraryModalComponent,
    componentProps: {
      itinerary: itineraryDays
    },
    cssClass: 'view-itinerary-modal'
  });

  await modal.present();
}

private convertToViewItineraryFormat(completedItinerary: any): ViewItineraryDay[] {
  // If there are no days, return empty array
  if (!completedItinerary.days || completedItinerary.days.length === 0) {
    return [];
  }

  // Map each day to the ViewItineraryDay format
  return completedItinerary.days.map((day: any, index: number) => {
    // Separate spots, restaurants, and hotels from the day's spots
    const touristSpots: ViewItinerarySpot[] = [];
    const restaurants: ViewItinerarySpot[] = [];
    const hotels: ViewItinerarySpot[] = [];
    
    // Find the chosen hotel if any
    let chosenHotel: any = null;

    // Process each spot in the day
    day.spots?.forEach((spot: any) => {
      // Create base spot object
      const viewSpot: ViewItinerarySpot = {
        id: spot.id || `spot_${Date.now()}_${Math.random()}`,
        name: spot.name || 'Unknown Spot',
        description: spot.description || '',
        category: spot.category || 'GENERAL',
        timeSlot: spot.timeSlot || '09:00',
        estimatedDuration: this.formatDuration(spot.duration || spot.estimatedDuration || '2 hours'),
        location: spot.location || { lat: 0, lng: 0 },
        mealType: spot.mealType,
        chosenRestaurant: spot.chosenRestaurant || null
      };

      // Check if this is Fort San Pedro, Anjo World Theme Park (tourist spots)
      if (spot.name === 'Fort San Pedro' || 
          spot.name === 'Anjo World Theme Park' || 
          spot.category === 'tourist_spot' || 
          spot.type === 'tourist_spot') {
        touristSpots.push(viewSpot);
      }
      // Check if this is McDonald's or Jollibee (restaurants)
      else if (spot.name === 'McDonald\'s' || 
               spot.name === 'Jollibee' || 
               spot.category === 'restaurant' || 
               spot.type === 'restaurant' ||
               spot.restaurant) {
        restaurants.push(viewSpot);
      }
      // Check if this is a hotel
      else if (spot.name.includes('Inn') || 
               spot.name.includes('Hotel') || 
               spot.category === 'hotel' || 
               spot.type === 'hotel' ||
               spot.hotel) {
        
        // Check if this is the chosen hotel (Travelbee Minglanilla Inn)
        if (spot.isChosen || spot.name === 'Travelbee Minglanilla Inn') {
          chosenHotel = {
            ...viewSpot,
            name: spot.hotel || spot.name,
            vicinity: spot.vicinity,
            rating: spot.rating,
            description: spot.description || 'Check-in: Evening'
          };
        } else {
          hotels.push(viewSpot);
        }
      }
      // Default to tourist spot if no specific category
      else {
        touristSpots.push(viewSpot);
      }
    });

    // Sort each array by timeSlot
    touristSpots.sort((a, b) => this.compareTime(a.timeSlot, b.timeSlot));
    restaurants.sort((a, b) => this.compareTime(a.timeSlot, b.timeSlot));
    hotels.sort((a, b) => this.compareTime(a.timeSlot, b.timeSlot));

    // Create the ViewItineraryDay object
    return {
      day: index + 1,
      date: day.date || completedItinerary.date,
      spots: touristSpots,
      restaurants: restaurants,
      hotels: hotels,
      chosenHotel: chosenHotel
    };
  });
}

// Helper method to format duration
private formatDuration(duration: string | number): string {
  if (!duration) return '2 hours';
  
  // If it's a number (minutes), convert to readable format
  if (typeof duration === 'number') {
    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hours`;
    }
    return `${duration} min`;
  }
  
  // If it's already a string, return as is
  return duration;
}

// Helper method to compare time strings
private compareTime(timeA: string, timeB: string): number {
  const [hoursA, minutesA] = (timeA || '00:00').split(':').map(Number);
  const [hoursB, minutesB] = (timeB || '00:00').split(':').map(Number);
  
  const totalMinutesA = hoursA * 60 + minutesA;
  const totalMinutesB = hoursB * 60 + minutesB;
  
  return totalMinutesA - totalMinutesB;
}

  async deleteItinerary(itinerary: any) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Completed Itinerary',
      subHeader: itinerary.name,
      message: 'Are you sure you want to delete this completed itinerary? This will also delete all associated expense records. This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: async () => {
            try {
              await this.performItineraryDeletion(itinerary);
              this.showToast('Itinerary deleted successfully', 'success');

              // Refresh the list
              await this.loadCompletedItineraries();
            } catch (error) {
              console.error('Error deleting itinerary:', error);
              this.showToast('Failed to delete itinerary', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async performItineraryDeletion(itinerary: any): Promise<void> {
    try {
      // 1. Delete all calendar events for this itinerary
      const allEvents = await this.calendarService.loadAllItineraryEvents();
      const itineraryEvents = allEvents.filter(event => {
        const eventDate = event.start.split('T')[0];
        return eventDate === itinerary.date;
      });

      // Delete each calendar event
      for (const event of itineraryEvents) {
        if (event.id) {
          await this.calendarService.deleteEvent(event.id);
        }
      }

      // 2. Delete all budget expenses for this itinerary
      const allExpenses = await this.budgetService.getCurrentExpenses();
      const itineraryIdCandidates = this.getItineraryIdCandidates(itinerary);
      const itineraryExpenses = allExpenses.filter(expense =>
        (expense.itineraryId && itineraryIdCandidates.includes(expense.itineraryId)) ||
        (expense.date && this.getLocalDateString(expense.date) === itinerary.date)
      );

      // Delete each expense
      for (const expense of itineraryExpenses) {
        if (expense.id) {
          await this.budgetService.deleteExpense(expense.id);
        }
      }

    } catch (error) {
      console.error('Error in performItineraryDeletion:', error);
      throw error;
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }

  goBack() {
    this.navCtrl.back();
  }

  /**
   * Generate what the original itinerary ID would have been before completion
   */
  private generateOriginalItineraryId(itinerary: any): string {
    if (itinerary.days && itinerary.days.length > 0) {
      const spotNames = itinerary.days
        .map((day: any) => day.spots?.map((spot: any) => spot.name) || [])
        .reduce((acc: any[], spots: any[]) => acc.concat(spots), [])
        .join('_');
      return `itinerary_${spotNames.substring(0, 50).replace(/\s+/g, '_')}`;
    }
    return '';
  }

  private getItineraryIdCandidates(itinerary: any): string[] {
    const candidates = [
      itinerary?.id,
      itinerary?.originalItineraryId,
      itinerary?.date ? `itinerary_${itinerary.date}` : '',
      itinerary?.date ? `completed_itinerary_${itinerary.date}` : '',
      this.generateOriginalItineraryId(itinerary)
    ].filter((value): value is string => !!value);

    return Array.from(new Set(candidates));
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
}
