import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { CalendarService, GlobalEvent } from '../services/calendar.service';
import { EventDetailModalComponent } from '../modals/event-detail-modal/event-detail-modal.component';
import { ViewItineraryModalComponent, ViewItineraryDay, ViewItinerarySpot } from '../modals/view-itinerary-modal/view-itinerary-modal.component';

@Component({
  standalone: false,
  selector: 'app-user-calendar',
  templateUrl: './user-calendar.page.html',
  styleUrls: ['./user-calendar.page.scss'],
})
export class UserCalendarPage implements OnInit {
  events: GlobalEvent[] = [];
  isLoading = false;
  selectedDate: string = '';
  currentMonth = new Date();
  private calendarDatesCache: Date[] = [];
  private currentMonthCache: string = '';
  private eventsCache: { [dateString: string]: GlobalEvent[] } = {};
  isNavigating = false;
  private isOpeningModal = false;

  constructor(
    private calendarService: CalendarService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) { }

  async ngOnInit() {
    localStorage.removeItem('calendar_selected_date');
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    await this.loadEvents();
  }

  async ionViewWillEnter() {
    if (!this.selectedDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.selectedDate = `${year}-${month}-${day}`;
    }
    await this.loadEvents();
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      const [globalEvents, legacyEvents] = await Promise.all([
        this.calendarService.loadUserCalendarEvents(),
        this.calendarService.loadItineraryEvents()
      ]);

      const convertedLegacyEvents = legacyEvents.map(event => 
        this.calendarService.calendarEventToGlobalEvent(event, 'user')
      );

      this.events = [...globalEvents, ...convertedLegacyEvents];
      
      this.clearCalendarCaches();
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading events in user calendar:', error);
      this.isLoading = false;
    }
  }

  private clearCalendarCaches() {
    this.calendarDatesCache = [];
    this.currentMonthCache = '';
    this.eventsCache = {};
  }

  async refreshEvents() {
    await this.loadEvents();
  }

  async clearAllEvents() {
    const alert = await this.alertCtrl.create({
      header: 'Clear All Events',
      message: 'This will delete all your calendar events. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            try {
              localStorage.removeItem('user_itinerary_events');
              
              this.events = [];
              
              this.showAlert('Success', 'All events have been cleared. You can now create a new itinerary with correct timing.');
            } catch (error) {
              console.error('Error clearing events:', error);
              this.showAlert('Error', 'Failed to clear events. Please try again.');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  getEventColor(event: GlobalEvent): string {
    if (event.createdByType === 'admin') {
      return 'warning';
    }
    
    switch (event.eventType) {
      case 'restaurant':
        return 'warning'; 
      case 'hotel':
        return 'primary'; 
      case 'tourist_spot':
        return 'success'; 
      default:
        return 'medium';
    }
  }

  getEventsForDate(date: Date): GlobalEvent[] {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (this.eventsCache[dateStr]) {
      return this.eventsCache[dateStr];
    }
    
    const allEventsForDate = this.events.filter(event => {
      return event.date === dateStr;
    });
    
    const consolidatedEvents = this.consolidateEventsForDisplay(allEventsForDate);
    
    this.eventsCache[dateStr] = consolidatedEvents;
    
    return consolidatedEvents;
  }

  getAllEventsForDate(date: Date): GlobalEvent[] {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return this.events.filter(event => {
      return event.date === dateStr;
    });
  }

  private consolidateEventsForDisplay(events: GlobalEvent[]): GlobalEvent[] {
    if (events.length === 0) return events;

    const itineraryEvents = events.filter(event => 
      event.createdByType === 'user' && 
      (event.eventType === 'user_itinerary' || event.eventType === 'tourist_spot' || 
       event.eventType === 'restaurant' || event.eventType === 'hotel')
    );
    
    const adminEvents = events.filter(event => event.createdByType === 'admin');

    const consolidatedEvents: GlobalEvent[] = [];

    if (itineraryEvents.length > 0) {
      const sortedItineraryEvents = itineraryEvents.sort((a, b) => a.time.localeCompare(b.time));
      const firstEvent = sortedItineraryEvents[0];
      
      const consolidatedEvent: GlobalEvent = {
        ...firstEvent,
        id: `itinerary_${firstEvent.date}`,
        name: `Itinerary (${itineraryEvents.length} activities)`,
        description: `${itineraryEvents.length} planned activities for this day`,
        eventType: 'user_itinerary'
      };
      
      consolidatedEvents.push(consolidatedEvent);
    }

    consolidatedEvents.push(...adminEvents);

    return consolidatedEvents;
  }

  async onDateSelected(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    const allEventsForDate = this.getAllEventsForDate(date);
    if (allEventsForDate.length > 0) {
      const hasUserItineraryEvents = allEventsForDate.some(event => 
        event.createdByType === 'user' && 
        (event.eventType === 'user_itinerary' || event.eventType === 'tourist_spot' || 
         event.eventType === 'restaurant' || event.eventType === 'hotel')
      );
      
      if (hasUserItineraryEvents || allEventsForDate.length > 1) {
        await this.showItineraryModal(allEventsForDate, this.selectedDate);
      } else {
        await this.showEventModal(allEventsForDate[0]);
      }
    }
  }

  previousMonth() {
    this.isNavigating = true;
    setTimeout(() => {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
      this.clearCalendarCaches();
      this.isNavigating = false;
    }, 50);
  }

  nextMonth() {
    this.isNavigating = true;
    setTimeout(() => {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
      this.clearCalendarCaches();
      this.isNavigating = false;
    }, 50);
  }

  getCurrentMonthYear(): string {
    return this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getDayHeaders(): string[] {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  }

  getCalendarDates(): Date[] {
    const monthKey = `${this.currentMonth.getFullYear()}-${this.currentMonth.getMonth()}`;
    
    if (this.currentMonthCache === monthKey && this.calendarDatesCache.length > 0) {
      return this.calendarDatesCache;
    }
    
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    this.calendarDatesCache = dates;
    this.currentMonthCache = monthKey;
    
    return dates;
  }

  getDayNumber(date: Date): number {
    return date.getDate();
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentMonth.getMonth() && 
           date.getFullYear() === this.currentMonth.getFullYear();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  isSelectedDate(date: Date): boolean {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return dateStr === this.selectedDate;
  }

  hasItineraryEvents(date: Date): boolean {
    const allEventsForDate = this.getAllEventsForDate(date);
    return allEventsForDate.some(event => 
      event.createdByType === 'user' && 
      (event.eventType === 'user_itinerary' || event.eventType === 'tourist_spot' || 
       event.eventType === 'restaurant' || event.eventType === 'hotel')
    );
  }

  hasMultipleEvents(date: Date): boolean {
    const allEventsForDate = this.getAllEventsForDate(date);
    return allEventsForDate.length > 1;
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  getEventCategory(event: GlobalEvent): string {
    switch (event.eventType) {
      case 'restaurant':
        return 'Restaurant';
      case 'hotel':
        return 'Hotel';
      case 'tourist_spot':
        return 'Tourist Spot';
      case 'user_itinerary':
        return 'My Itinerary';
      case 'admin_event':
        return 'Event';
      default:
        return 'Event';
    }
  }

  isCurrentDayOfWeek(day: string): boolean {
    const today = new Date();
    const todayDay = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    return day === todayDay;
  }

  trackByDate(index: number, date: Date): string {
    return date.toISOString().split('T')[0];
  }

  trackByEventId(index: number, event: GlobalEvent): string {
    return event.id || index.toString();
  }

  async onEventClick(event: GlobalEvent, clickEvent: Event) {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();

    if (this.isOpeningModal) return;
    this.isOpeningModal = true;

    try {
      const eventDate = new Date(event.date);
      const allEventsForDate = this.getAllEventsForDate(eventDate);

      const hasUserItineraryEvents = allEventsForDate.some(e =>
        e.createdByType === 'user' &&
        (e.eventType === 'user_itinerary' || e.eventType === 'tourist_spot' ||
         e.eventType === 'restaurant' || e.eventType === 'hotel')
      );

      if (hasUserItineraryEvents || allEventsForDate.length > 1) {
        await this.showItineraryModal(allEventsForDate, event.date);
      } else {
        await this.showEventModal(event);
      }
    } finally {
      this.isOpeningModal = false;
    }
  }

  async showEventModal(event: GlobalEvent) {
    try {
      const modal = await this.modalCtrl.create({
        component: EventDetailModalComponent,
        cssClass: 'event-detail-modal',
        componentProps: {
          event: event
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error showing modal:', error);
    }
  }

  async showItineraryModal(events: GlobalEvent[], dateString: string) {
    try {
      const itineraryDay = this.convertEventsToItineraryDay(events, dateString);
      
      const modal = await this.modalCtrl.create({
        component: ViewItineraryModalComponent,
        cssClass: 'event-details-modal',
        componentProps: {
          itinerary: [itineraryDay]
        },
        backdropDismiss: true
      });
      
      await modal.present();
    } catch (error) {
      console.error('Error showing itinerary modal:', error);
    }
  }

  private convertEventsToItineraryDay(events: GlobalEvent[], dateString: string): ViewItineraryDay {
    const sortedEvents = events.sort((a, b) => a.time.localeCompare(b.time));
    
    const spots: ViewItinerarySpot[] = [];
    const restaurants: ViewItinerarySpot[] = [];
    const hotels: ViewItinerarySpot[] = [];
    let chosenHotel: any = null;

    const dayNumber = this.calculateItineraryDayNumber(events, dateString);

    sortedEvents.forEach((event, index) => {
      const spot: ViewItinerarySpot = {
        id: event.id || `event_${index}`,
        name: event.name,
        description: event.description || '',
        category: this.getEventCategory(event),
        timeSlot: event.time,
        estimatedDuration: '2 hours',
        location: { lat: 0, lng: 0 },
        mealType: event.eventType === 'restaurant' ? this.getMealTypeFromTime(event.time) : undefined
      };

      switch (event.eventType) {
        case 'restaurant':
          restaurants.push(spot);
          break;
        case 'hotel':
          hotels.push(spot);
          if (index === sortedEvents.length - 1 || 
              !sortedEvents.slice(index + 1).some(e => e.eventType === 'hotel')) {
            chosenHotel = {
              name: event.name,
              description: event.description,
              rating: null,
              vicinity: event.location
            };
          }
          break;
        default:
          spots.push(spot);
          break;
      }
    });

    return {
      day: dayNumber,
      date: dateString,
      spots: spots,
      restaurants: restaurants,
      hotels: hotels,
      chosenHotel: chosenHotel
    };
  }

  private calculateItineraryDayNumber(events: GlobalEvent[], targetDateString: string): number {
    const allItineraryEvents = this.events.filter(event => 
      event.createdByType === 'user' && 
      (event.eventType === 'user_itinerary' || event.eventType === 'tourist_spot' || 
       event.eventType === 'restaurant' || event.eventType === 'hotel')
    );

    const uniqueDates = [...new Set(allItineraryEvents.map(event => event.date))].sort();
    
    const itineraryGroups = this.groupDatesByItinerary(uniqueDates);
    
    for (const group of itineraryGroups) {
      const dayIndex = group.findIndex(date => date === targetDateString);
      if (dayIndex >= 0) {
        return dayIndex + 1;
      }
    }
    
    return 1;
  }

  private groupDatesByItinerary(sortedDates: string[]): string[][] {
    if (sortedDates.length === 0) return [];
    
    const groups: string[][] = [];
    let currentGroup: string[] = [sortedDates[0]];
    
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const previousDate = new Date(sortedDates[i - 1]);
      
      const daysDifference = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > 1) {
        groups.push(currentGroup);
        currentGroup = [sortedDates[i]];
      } else {
        currentGroup.push(sortedDates[i]);
      }
    }
    
    groups.push(currentGroup);
    
    return groups;
  }

  private getMealTypeFromTime(time: string): string {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 6 && hour < 11) {
      return 'breakfast';
    } else if (hour >= 11 && hour < 16) {
      return 'lunch';
    } else {
      return 'dinner';
    }
  }
}
