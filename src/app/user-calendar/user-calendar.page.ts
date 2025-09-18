import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { CalendarService, GlobalEvent } from '../services/calendar.service';
import { EventDetailModalComponent } from '../modals/event-detail-modal/event-detail-modal.component';

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
  viewMode: 'grid' | 'agenda' = 'grid';
  // Cache for performance
  private calendarDatesCache: Date[] = [];
  private currentMonthCache: string = '';
  private eventsCache: { [dateString: string]: GlobalEvent[] } = {};
  isNavigating = false;

  constructor(
    private calendarService: CalendarService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) { }

  async ngOnInit() {
    // Clear any stored selected date and ensure it's set to today
    localStorage.removeItem('calendar_selected_date');
    
    // Create today's date string without timezone issues
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    await this.loadEvents();
  }

  async ionViewWillEnter() {
    // Ensure selectedDate is set to today when entering the page
    if (!this.selectedDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.selectedDate = `${year}-${month}-${day}`;
    }
    await this.loadEvents();
  }

  loadEvents() {
    this.isLoading = true;
    this.calendarService.loadUserCalendarEvents().then(events => {
      this.events = events;
      // Clear caches when events are reloaded
      this.clearCalendarCaches();
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading events in user calendar:', error);
      this.isLoading = false;
    });
  }

  private clearCalendarCaches() {
    this.calendarDatesCache = [];
    this.currentMonthCache = '';
    this.eventsCache = {};
  }

  async refreshEvents() {
    this.isLoading = true;
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
              // Clear from localStorage
              localStorage.removeItem('user_itinerary_events');
              
              // Clear the events array
              this.events = [];
              
              // Show success message
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

  // Debug method to add test events
  addTestEvents() {
    const testEvents: any[] = [
      {
        id: '1',
        title: 'Kawasan Falls',
        start: '2025-08-07T08:00:00',
        end: '2025-08-07T10:00:00',
        extendedProps: {
          isItineraryEvent: true,
          description: 'Visit the beautiful Kawasan Falls'
        }
      },
      {
        id: '2',
        title: 'Robinsons Galleria Cebu',
        start: '2025-08-07T11:20:00',
        end: '2025-08-07T13:20:00',
        extendedProps: {
          isItineraryEvent: true,
          description: 'Shopping at Robinsons Galleria'
        }
      },
      {
        id: '3',
        title: 'Yap-San Diego Ancestral House',
        start: '2025-08-07T14:40:00',
        end: '2025-08-07T16:40:00',
              extendedProps: {
          isItineraryEvent: true,
          description: 'Historical house tour'
        }
      },
      {
        id: '4',
        title: 'Cebu Business Hotel',
        start: '2025-08-07T18:00:00',
        end: '2025-08-07T20:00:00',
        extendedProps: {
          isItineraryEvent: true,
          description: 'Hotel check-in and dinner'
        }
      }
    ];

    localStorage.setItem('user_itinerary_events', JSON.stringify(testEvents));
    this.loadEvents();
  }

  async deleteEvent(eventId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Event',
      message: 'Are you sure you want to delete this event?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              // Remove from local events array
              this.events = this.events.filter(e => e.id !== eventId);
              
              // Update localStorage
              localStorage.setItem('user_itinerary_events', JSON.stringify(this.events));
              
              this.showAlert('Success', 'Event deleted successfully.');
            } catch (error) {
              console.error('Error deleting event:', error);
              this.showAlert('Error', 'Failed to delete event.');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  getEventDate(event: GlobalEvent): string {
    const date = new Date(event.date);
    return date.toLocaleDateString();
  }

  getEventTime(event: GlobalEvent): string {
    return event.time;
  }

  getEventEndTime(event: GlobalEvent): string {
    // For now, return the same time as start time
    return event.time;
  }

  getEventIcon(event: GlobalEvent): string {
    switch (event.eventType) {
      case 'restaurant':
        return 'restaurant-outline';
      case 'hotel':
        return 'bed-outline';
      case 'tourist_spot':
        return 'location-outline';
      default:
        return 'calendar-outline';
    }
  }

  getEventColor(event: GlobalEvent): string {
    if (event.createdByType === 'admin') {
      return 'warning'; // Yellow for admin events
    }
    
    switch (event.eventType) {
      case 'restaurant':
        return 'warning'; // Yellow for restaurants
      case 'hotel':
        return 'primary'; // Blue for hotels
      case 'tourist_spot':
        return 'success'; // Green for tourist spots
      default:
        return 'medium';
    }
  }

  getEventsForDate(date: Date): GlobalEvent[] {
    // Create date string for comparison without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Use cached events if available
    if (this.eventsCache[dateStr]) {
      return this.eventsCache[dateStr];
    }
    
    const eventsForDate = this.events.filter(event => {
      return event.date === dateStr;
    });
    
    // Cache the result
    this.eventsCache[dateStr] = eventsForDate;
    
    return eventsForDate;
  }

  async onDateSelected(date: Date) {
    // Create a date string in YYYY-MM-DD format without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    // Check if this date has events
    const eventsForDate = this.getEventsForDate(date);
    if (eventsForDate.length > 0) {
      // Show modal with the first event for this date
      await this.showEventModal(eventsForDate[0]);
    }
  }

  // Method to reset selected date to today
  resetToToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
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
    
    // Use cached dates if available
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
    
    // Generate exactly 42 dates (6 weeks x 7 days) for consistent grid
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Cache the results
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
    // Create date string for comparison without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return dateStr === this.selectedDate;
  }


  openInGoogleCalendar(event: GlobalEvent) {
    // This would open the event in Google Calendar if it was created there
    // For now, just show a message
    this.showAlert('Info', 'This feature would open the event in Google Calendar.');
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // New methods for agenda view
  getMonthTabs(): any[] {
    const months = [];
    const currentDate = new Date(this.currentMonth);
    
    for (let i = -2; i <= 2; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      months.push({
        name: date.toLocaleDateString('en-US', { month: 'short' }),
        date: date,
        isCurrent: date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
      });
    }
    
    return months;
  }

  goToMonth(date: Date) {
    this.isNavigating = true;
    setTimeout(() => {
      this.currentMonth = new Date(date);
      this.clearCalendarCaches();
      this.isNavigating = false;
    }, 50);
  }

  getSelectedDayName(): string {
    const selected = new Date(this.selectedDate);
    return selected.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getSelectedDayNumber(): number {
    const selected = new Date(this.selectedDate);
    return selected.getDate();
  }

  getEventsForSelectedDate(): GlobalEvent[] {
    return this.events.filter(event => {
      return event.date === this.selectedDate;
    });
  }

  getAllEventsSorted(): GlobalEvent[] {
    const sortedEvents = this.events
      .filter(event => {
        const eventDate = new Date(event.date);
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const currentMonth = this.currentMonth.getMonth();
        const currentYear = this.currentMonth.getFullYear();
        const isInCurrentMonth = eventMonth === currentMonth && eventYear === currentYear;
        return isInCurrentMonth;
      })
      .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
    return sortedEvents;
  }

  getEventsGroupedByDate(): { date: string; events: GlobalEvent[] }[] {
    const events = this.getAllEventsSorted();
    const grouped: { [key: string]: GlobalEvent[] } = {};
    
    events.forEach(event => {
      const dateKey = event.date;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    // Convert to array and sort by date
    return Object.keys(grouped)
      .map(dateKey => ({ date: dateKey, events: grouped[dateKey] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getEventsGroupedByWeek(): { weekStart: Date; dateGroups: { date: string; events: GlobalEvent[] }[] }[] {
    const allEvents = this.getAllEventsSorted();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    
    const firstWeekStart = this.getWeekStart(firstDayOfMonth);
    const lastWeekStart = this.getWeekStart(lastDayOfMonth);
    
    const weekGroups: { weekStart: Date; dateGroups: { date: string; events: GlobalEvent[] }[] }[] = [];
    
    let currentWeekStart = new Date(firstWeekStart);
    while (currentWeekStart <= lastWeekStart) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      if (weekEnd >= today) {
        const dateGroups: { date: string; events: GlobalEvent[] }[] = [];
        
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(currentWeekStart);
          currentDate.setDate(currentDate.getDate() + i);
          
          const dateString = currentDate.toISOString().split('T')[0];
          const eventsForDate = allEvents.filter(event => {
            return event.date === dateString;
          });
          
          if (eventsForDate.length > 0) {
            dateGroups.push({ date: dateString, events: eventsForDate });
          }
        }
        
        weekGroups.push({ weekStart: new Date(currentWeekStart), dateGroups });
      }
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    return weekGroups;
  }

  getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const dayOfWeek = weekStart.getDay();
    
    // Normalize to start of day (remove time component)
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    
    return weekStart;
  }

  getWeekRange(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
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

  getEventDayName(event: GlobalEvent): string {
    const date = new Date(event.date);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getEventDayNumber(event: GlobalEvent): number {
    const date = new Date(event.date);
    return date.getDate();
  }

  isCurrentDayOfWeek(day: string): boolean {
    const today = new Date();
    const todayDay = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    return day === todayDay;
  }

  // TrackBy functions for performance
  trackByDate(index: number, date: Date): string {
    return date.toISOString().split('T')[0];
  }

  trackByEventId(index: number, event: GlobalEvent): string {
    return event.id || index.toString();
  }

  trackByWeekGroup(index: number, weekGroup: any): string {
    return weekGroup.weekStart.toISOString();
  }

  trackByDateGroup(index: number, dateGroup: any): string {
    return dateGroup.date;
  }

  // Simple getters for template performance
  get sortedEvents(): GlobalEvent[] {
    return this.events.filter(event => {
      const eventDate = new Date(event.date);
      const eventMonth = eventDate.getMonth();
      const eventYear = eventDate.getFullYear();
      const currentMonth = this.currentMonth.getMonth();
      const currentYear = this.currentMonth.getFullYear();
      return eventMonth === currentMonth && eventYear === currentYear;
    }).sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
  }

  get eventsGroupedByWeek(): any[] {
    // Simplified version - just return current month events grouped by week
    const currentEvents = this.sortedEvents;
    if (currentEvents.length === 0) return [];
    
    // Simple grouping by week
    const weeks: any[] = [];
    const eventsByDate: { [key: string]: GlobalEvent[] } = {};
    
    currentEvents.forEach(event => {
      if (!eventsByDate[event.date]) {
        eventsByDate[event.date] = [];
      }
      eventsByDate[event.date].push(event);
    });
    
    Object.keys(eventsByDate).forEach(dateKey => {
      const events = eventsByDate[dateKey];
      const weekStart = new Date(dateKey);
      weeks.push({
        weekStart: weekStart,
        dateGroups: [{ date: dateKey, events: events }]
      });
    });
    
    return weeks;
  }

  // Event Click Handler
  onEventClick(event: GlobalEvent, clickEvent: Event) {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();
    
    // Show modal without blocking UI
    this.showEventModal(event);
  }

  // Event Modal Methods
  showEventModal(event: GlobalEvent) {
    // Use zone.runOutsideAngular if available, or setTimeout for non-blocking execution
    setTimeout(() => {
      this.modalCtrl.create({
        component: EventDetailModalComponent,
        cssClass: 'event-detail-modal',
        componentProps: {
          event: event
        }
      }).then(modal => {
        modal.present();
      }).catch(error => {
        console.error('Error showing modal:', error);
      });
    }, 0);
  }
}
