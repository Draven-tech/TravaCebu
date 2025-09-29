import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { CalendarService, GlobalEvent } from '../../services/calendar.service';

@Component({
  standalone: false,
  selector: 'app-event-list',
  templateUrl: './event-list.page.html',
  styleUrls: ['./event-list.page.scss'],
})
export class EventListPage implements OnInit {
  events: any[] = [];
  isLoading = true;
  searchQuery = '';
  activeTab = 'event-list'; // Default to event list tab
  showEventModal = false;
  selectedEvent: any = null;
  showPreviousEventsModal = false;
  isLoadingPastEvents = false;
  // Calendar properties
  selectedDate: string = '';
  currentMonth = new Date();
  viewMode: 'grid' | 'agenda' = 'grid';
  // Cache for performance
  private calendarDatesCache: Date[] = [];
  private currentMonthCache: string = '';
  private eventsCache: { [dateString: string]: any[] } = {};
  isNavigating = false;
  // Date events modal
  showDateEventsModal = false;
  selectedDateEvents: any[] = [];
  selectedDateString = '';
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 6;
  paginatedEvents: any[] = [];
  totalPages = 1;

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public datePipe: DatePipe,
    private calendarService: CalendarService
  ) {}

  ngOnInit() {
    // Initialize selected date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    this.loadEvents();
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      // Load admin events using new global event system
      const adminEvents = await this.calendarService.loadAdminEvents();
      
      // Convert to display format
      this.events = adminEvents.map(event => ({
        id: event.id,
        name: event.name,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        spotId: event.spotId,
        imageUrl: event.imageUrl,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      })).sort((a, b) => {
        // Sort by date descending, then by time
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Clear caches when events are reloaded
      this.clearCalendarCaches();
      
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading events:', error);
      this.isLoading = false;
      this.showAlert('Error', 'Failed to load events');
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

  async openEventDetail(event: any) {
    const alert = await this.alertCtrl.create({
      header: event.name,
      message: `
        <div style="text-align: left;">
          <p><strong>Description:</strong> ${event.description || 'No description'}</p>
          <p><strong>Date:</strong> ${event.date}</p>
          <p><strong>Time:</strong> ${event.time}</p>
          <p><strong>Location:</strong> ${event.location}</p>
          <p><strong>Created:</strong> ${this.datePipe.transform(event.createdAt, 'medium')}</p>
          ${event.updatedAt ? `<p><strong>Updated:</strong> ${this.datePipe.transform(event.updatedAt, 'medium')}</p>` : ''}
        </div>
      `,
      buttons: [
        {
          text: 'Edit',
          handler: () => {
            this.editEvent(event);
          }
        },
        {
          text: 'Close',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  editEvent(event: any) {
    this.navCtrl.navigateForward(['/admin/event-editor'], {
      state: { eventToEdit: event }
    });
  }

  navigateToEditor() {
    this.navCtrl.navigateForward('/admin/event-editor');
  }

  async deleteEvent(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
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
              // Delete using new global event system
              await this.calendarService.deleteGlobalEvent(id);
              
              this.showAlert('Success', 'Event deleted successfully');
              await this.loadEvents(); // Reload the list
            } catch (err) {
              console.error(err);
              this.showAlert('Error', 'Failed to delete event');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  filterEvents() {
    if (!this.searchQuery) {
      return this.events;
    }
    return this.events.filter(event => 
      event.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    // If switching to calendar tab, we can add calendar-specific logic here later
    if (tab === 'calendar') {
      // Future: Initialize calendar view
    }
  }

  onTabChange() {
    // Handle tab change event from ion-segment
    }

  getUpcomingEvents() {
    const now = new Date();
    let filteredEvents = this.events;
    
    // Apply search filter if there's a search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filteredEvents = this.events.filter(event => 
        event.name.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      );
    }
    
    // Sort by date/time - upcoming events first
    const sortedEvents = filteredEvents.sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.time);
      const dateB = new Date(b.date + 'T' + b.time);
      
      // If both are future events or both are past events, sort chronologically
      const isAFuture = dateA >= now;
      const isBFuture = dateB >= now;
      
      if (isAFuture && isBFuture) {
        // Both future: earliest first
        return dateA.getTime() - dateB.getTime();
      } else if (!isAFuture && !isBFuture) {
        // Both past: most recent first
        return dateB.getTime() - dateA.getTime();
      } else {
        // Future events before past events
        return isAFuture ? -1 : 1;
      }
    });

    // Update pagination
    this.updatePagination(sortedEvents);
    
    return this.paginatedEvents;
  }

  // Pagination methods (like user dashboard)
  updatePagination(allEvents: any[]): void {
    this.totalPages = Math.ceil(allEvents.length / this.itemsPerPage);
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedEvents = allEvents.slice(startIndex, endIndex);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.getUpcomingEvents(); // Refresh pagination
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.getUpcomingEvents(); // Refresh pagination
    }
  }

  formatEventDateTime(event: any): string {
    const eventDate = new Date(event.date + 'T' + event.time);
    const now = new Date();
    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    const dateStr = eventDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
    
    const timeStr = event.time;
    
    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${timeStr}`;
    } else if (diffDays > 0 && diffDays <= 7) {
      return `${dateStr} at ${timeStr}`;
    } else if (diffDays < 0 && diffDays >= -7) {
      return `${dateStr} at ${timeStr} (Past)`;
    } else {
      return `${dateStr} at ${timeStr}`;
    }
  }

  onSearchInput(event: any) {
    // Handle search input like user dashboard
    this.searchQuery = event.target.value;
    this.currentPage = 1; // Reset to first page when searching
  }

  openEventDetailModal(event: any) {
    this.selectedEvent = event;
    this.showEventModal = true;
  }

  editEventFromModal(event: any) {
    this.showEventModal = false;
    this.editEvent(event);
  }

  async deleteEventFromModal(eventId: string) {
    this.showEventModal = false;
    await this.deleteEvent(eventId);
  }

  openPreviousEventsModal() {
    this.showPreviousEventsModal = true;
    this.isLoadingPastEvents = false; // We already have events loaded
  }

  getPastEvents() {
    const now = new Date();
    let pastEvents = this.events.filter(event => {
      const eventDate = new Date(event.date + 'T' + event.time);
      return eventDate < now;
    });

    // Apply search filter if there's a search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      pastEvents = pastEvents.filter(event => 
        event.name.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      );
    }
    
    // Sort past events by most recent first
    return pastEvents.sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.time);
      const dateB = new Date(b.date + 'T' + b.time);
      return dateB.getTime() - dateA.getTime();
    });
  }

  formatPastEventDate(event: any): string {
    const eventDate = new Date(event.date + 'T' + event.time);
    const now = new Date();
    const diffMs = now.getTime() - eventDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const dateStr = eventDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    const timeStr = event.time;
    
    if (diffDays === 0) {
      return `Earlier today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays <= 7) {
      return `${diffDays} days ago at ${timeStr}`;
    } else {
      return `${dateStr} at ${timeStr}`;
    }
  }

  openPastEventDetail(event: any) {
    this.selectedEvent = event;
    this.showPreviousEventsModal = false;
    this.showEventModal = true;
  }

  async deletePastEvent(eventId: string) {
    await this.deleteEvent(eventId);
  }

  // Calendar Methods (adapted from user-calendar)
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return dateStr === this.selectedDate;
  }

  getEventsForDate(date: Date): any[] {
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

  onDateSelected(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    this.selectedDate = dateStr;
    
    // Check if this date has events
    const eventsForDate = this.getEventsForDate(date);
    if (eventsForDate.length > 0) {
      this.openDateEventsModal(date, eventsForDate);
    }
  }

  openDateEventsModal(date: Date, events: any[]) {
    this.selectedDateEvents = events;
    this.selectedDateString = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    this.showDateEventsModal = true;
  }

  closeDateEventsModal() {
    this.showDateEventsModal = false;
    this.selectedDateEvents = [];
    this.selectedDateString = '';
  }

  openEventFromDateModal(event: any) {
    this.closeDateEventsModal();
    this.openEventDetailModal(event);
  }

  hasEvents(date: Date): boolean {
    return this.getEventsForDate(date).length > 0;
  }

  getEventCount(date: Date): number {
    return this.getEventsForDate(date).length;
  }

  getEventColor(event: any): string {
    // Admin events get warning color
    if (event.extendedProps?.isAdminEvent === true) {
      return 'warning';
    }
    return 'primary';
  }

  getEventTime(event: any): string {
    if (!event.time) return '';
    return event.time;
  }

  showEventDetails(event: any, eventObj: any) {
    if (eventObj) {
      eventObj.stopPropagation();
    }
    this.openEventDetailModal(event);
  }

  // Agenda view methods
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

  getEventsForSelectedDate(): any[] {
    return this.events.filter(event => {
      return event.date === this.selectedDate;
    });
  }

  getAllEventsSorted(): any[] {
    const sortedEvents = this.events
      .filter(event => {
        const eventDate = new Date(event.date);
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        const currentMonth = this.currentMonth.getMonth();
        const currentYear = this.currentMonth.getFullYear();
        return eventMonth === currentMonth && eventYear === currentYear;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateA.getTime() - dateB.getTime();
      });
    return sortedEvents;
  }

  getEventsGroupedByWeek(): { weekStart: Date; dateGroups: { date: string; events: any[] }[] }[] {
    const allEvents = this.getAllEventsSorted();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    
    const firstWeekStart = this.getWeekStart(firstDayOfMonth);
    const lastWeekStart = this.getWeekStart(lastDayOfMonth);
    
    const weekGroups: { weekStart: Date; dateGroups: { date: string; events: any[] }[] }[] = [];
    
    let currentWeekStart = new Date(firstWeekStart);
    while (currentWeekStart <= lastWeekStart) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      if (weekEnd >= today) {
        const dateGroups: { date: string; events: any[] }[] = [];
        
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

  getEventDayName(event: any): string {
    const date = new Date(event.date);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getEventDayNumber(event: any): number {
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

  trackByEventId(index: number, event: any): string {
    return event.id || index.toString();
  }
}
