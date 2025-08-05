import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { CalendarService, CalendarEvent } from '../services/calendar.service';

@Component({
  standalone: false,
  selector: 'app-user-calendar',
  templateUrl: './user-calendar.page.html',
  styleUrls: ['./user-calendar.page.scss'],
})
export class UserCalendarPage implements OnInit {
  events: CalendarEvent[] = [];
  isLoading = false;
  selectedDate: string = '';
  currentMonth = new Date();
  showEventModal = false;
  selectedEvent: CalendarEvent | null = null;
  viewMode: 'grid' | 'agenda' = 'grid';

  constructor(
    private calendarService: CalendarService,
    private alertCtrl: AlertController
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
    this.calendarService.loadItineraryEvents().then(events => {
      this.events = events;
      this.isLoading = false;
    });
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
    const testEvents: CalendarEvent[] = [
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

  getEventDate(event: CalendarEvent): string {
    const date = new Date(event.start);
    return date.toLocaleDateString();
  }

  getEventTime(event: CalendarEvent): string {
    const date = new Date(event.start);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getEventEndTime(event: CalendarEvent): string {
    if (!event.end) return '';
    const date = new Date(event.end);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isItineraryEvent(event: CalendarEvent): boolean {
    return event.extendedProps?.isItineraryEvent === true;
  }

  getEventIcon(event: CalendarEvent): string {
    if (this.isItineraryEvent(event)) {
      const eventType = event.extendedProps?.type;
      if (eventType === 'restaurant') {
        return 'restaurant-outline'; // Use outline version for better rendering
      } else if (eventType === 'hotel') {
        return 'bed-outline'; // Use outline version for consistency
      } else if (eventType === 'admin_event') {
        return 'star-outline'; // Star icon for admin events
      } else {
        return 'location-outline'; // Use outline version for consistency
      }
    }
    return 'calendar-outline';
  }

  getEventColor(event: CalendarEvent): string {
    if (this.isItineraryEvent(event)) {
      const eventType = event.extendedProps?.type;
      if (eventType === 'restaurant') {
        return 'warning'; // Orange for restaurants
      } else if (eventType === 'hotel') {
        return 'primary'; // Blue for hotels
      } else if (eventType === 'admin_event') {
        return 'warning'; // Orange for admin events (same as restaurants)
      } else {
        return 'success'; // Green for tourist spots
      }
    }
    return 'medium';
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    // Create date string for comparison without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return this.events.filter(event => {
      const eventDate = new Date(event.start);
      const eventYear = eventDate.getFullYear();
      const eventMonth = String(eventDate.getMonth() + 1).padStart(2, '0');
      const eventDay = String(eventDate.getDate()).padStart(2, '0');
      const eventDateStr = `${eventYear}-${eventMonth}-${eventDay}`;
      
      return eventDateStr === dateStr;
    });
  }

  onDateSelected(date: Date) {
    // Create a date string in YYYY-MM-DD format without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
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
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
  }

  getCurrentMonthYear(): string {
    return this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getDayHeaders(): string[] {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  }

  getCalendarDates(): Date[] {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate.getMonth() <= month || currentDate.getDay() !== 0) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
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

  showEventDetails(event: CalendarEvent, eventObj: any) {
    eventObj.stopPropagation();
    this.selectedEvent = event;
    this.showEventModal = true;
  }

  openInGoogleCalendar(event: CalendarEvent) {
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
    this.currentMonth = new Date(date);
    this.loadEvents();
  }

  getSelectedDayName(): string {
    const selected = new Date(this.selectedDate);
    return selected.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getSelectedDayNumber(): number {
    const selected = new Date(this.selectedDate);
    return selected.getDate();
  }

  getEventsForSelectedDate(): CalendarEvent[] {
    const selected = new Date(this.selectedDate);
    return this.events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === selected.getDate() && 
             eventDate.getMonth() === selected.getMonth() && 
             eventDate.getFullYear() === selected.getFullYear();
    });
  }

  getAllEventsSorted(): CalendarEvent[] {
    const sortedEvents = this.events
      .filter(event => {
        const eventDate = new Date(event.start);
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const currentMonth = this.currentMonth.getMonth();
        const currentYear = this.currentMonth.getFullYear();
        const isInCurrentMonth = eventMonth === currentMonth && eventYear === currentYear;
        return isInCurrentMonth;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return sortedEvents;
  }

  getEventsGroupedByDate(): { date: string; events: CalendarEvent[] }[] {
    const events = this.getAllEventsSorted();
    const grouped: { [key: string]: CalendarEvent[] } = {};
    
    events.forEach(event => {
      const eventDate = new Date(event.start);
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
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

  getEventsGroupedByWeek(): { weekStart: Date; dateGroups: { date: string; events: CalendarEvent[] }[] }[] {
    const allEvents = this.getAllEventsSorted();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the first day of the current month
    const firstDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    
    // Get the start of the week for the first day of the month
    const firstWeekStart = this.getWeekStart(firstDayOfMonth);
    const lastWeekStart = this.getWeekStart(lastDayOfMonth);
    
    const weekGroups: { weekStart: Date; dateGroups: { date: string; events: CalendarEvent[] }[] }[] = [];
    
    // Generate all weeks that overlap with the current month
    let currentWeekStart = new Date(firstWeekStart);
    while (currentWeekStart <= lastWeekStart) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      // Only include weeks that haven't completely passed
      if (weekEnd >= today) {
        const dateGroups: { date: string; events: CalendarEvent[] }[] = [];
        
        // Group events by date for this week
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(currentWeekStart);
          currentDate.setDate(currentDate.getDate() + i);
          
          const dateString = currentDate.toISOString().split('T')[0];
          const eventsForDate = allEvents.filter(event => {
            const eventDate = new Date(event.start);
            const eventDateString = eventDate.toISOString().split('T')[0];
            const matches = eventDateString === dateString;
            return matches;
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

  getEventCategory(event: CalendarEvent): string {
    if (this.isItineraryEvent(event)) {
      const eventType = event.extendedProps?.type;
      if (eventType === 'restaurant') {
        return 'Restaurant';
      } else if (eventType === 'hotel') {
        return 'Hotel';
      } else if (eventType === 'admin_event') {
        return 'Admin Event';
      } else {
        return 'My Itinerary';
      }
    }
    return 'Event';
  }

  getEventDayName(event: CalendarEvent): string {
    const date = new Date(event.start);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getEventDayNumber(event: CalendarEvent): number {
    const date = new Date(event.start);
    return date.getDate();
  }

  isCurrentDayOfWeek(day: string): boolean {
    const today = new Date();
    const todayDay = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    return day === todayDay;
  }
}
