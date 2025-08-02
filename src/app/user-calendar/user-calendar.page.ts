import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import { CalendarService } from '../services/calendar.service';

@Component({
  selector: 'app-user-calendar',
  templateUrl: './user-calendar.page.html',
  styleUrls: ['./user-calendar.page.scss'],
  standalone: false,
})
export class UserCalendarPage implements OnInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
  
  userId: string | null = null;
  userData: any = null;
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,title,next',
      center: '',
      right: 'today'
    },
    height: 'auto',
    weekends: true,
    events: [], // Will be populated with events from Firestore
    eventClick: this.handleEventClick.bind(this)
  };

  constructor(
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private calendarService: CalendarService
  ) { }

  async ngOnInit() {
    // Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }
    
    // Load user profile data
    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(data => {
      this.userData = data;
    });

    // Load events from admin
    this.loadEvents();
  }

  async loadEvents() {
    try {
      // Load admin events with error handling
      let adminEvents: any[] = [];
      try {
        const eventsSnapshot = await this.firestore.collection('events', ref => ref.orderBy('date', 'asc'))
          .get()
          .toPromise();
        
        if (eventsSnapshot && !eventsSnapshot.empty) {
          adminEvents = eventsSnapshot.docs.map(doc => {
            const event = doc.data() as any;
            return {
              id: doc.id,
              title: event.name,
              start: event.date, // YYYY-MM-DD format
              color: '#ffc409',  // Yellow highlight to match theme
              textColor: '#000',
              allDay: true,
              extendedProps: {
                description: event.description,
                time: event.time,
                location: event.location,
                spotId: event.spotId,
                imageUrl: event.imageUrl,
                type: 'admin_event'
              }
            };
          });
        }
      } catch (adminError) {
        console.warn('Could not load admin events:', adminError);
        // Continue without admin events
      }
      
      // Load saved itinerary events from calendar service
      const savedItineraryEvents = await this.loadSavedItineraryEvents();
      
      // Convert itinerary events to FullCalendar format if needed
      const formattedItineraryEvents = savedItineraryEvents.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        color: event.color || '#28a745', // Green for user events
        textColor: event.textColor || '#fff',
        allDay: event.allDay || false,
        extendedProps: event.extendedProps || {}
      }));
      
      // Remove duplicates by ID
      const uniqueEvents = new Map();
      
      // Add admin events
      adminEvents.forEach(event => {
        if (event.id) {
          uniqueEvents.set(event.id, event);
        }
      });
      
      // Add itinerary events (will overwrite duplicates)
      formattedItineraryEvents.forEach(event => {
        if (event.id) {
          uniqueEvents.set(event.id, event);
        }
      });
      
      // Convert back to array
      const allEvents = Array.from(uniqueEvents.values());
      
      console.log('Loaded events:', allEvents);
      
      // Update calendar with events
      this.calendarOptions.events = allEvents;
      
      // Force calendar refresh
      if (this.calendarComponent) {
        this.calendarComponent.getApi().refetchEvents();
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }

  private async loadSavedItineraryEvents(): Promise<any[]> {
    try {
      const events = await this.calendarService.loadItineraryEvents();
      console.log('Loaded saved itinerary events:', events);
      return events;
    } catch (error) {
      console.error('Error loading saved itinerary events:', error);
      return [];
    }
  }

  handleEventClick(clickInfo: EventClickArg) {
    const event = clickInfo.event;
    const props = event.extendedProps;
    
    console.log('Event clicked:', event);
    console.log('Event props:', props);
    
    // Create event details message
    let message = `<div style="text-align: left;">
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${new Date(event.start!).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${new Date(event.start!).toLocaleTimeString()}</p>`;
    
    // Handle different event types
    if (props['type'] === 'tourist_spot') {
      // Itinerary tourist spot event
      if (props['duration']) {
        message += `<p><strong>Duration:</strong> ${props['duration']}</p>`;
      }
      if (props['category']) {
        message += `<p><strong>Category:</strong> ${props['category']}</p>`;
      }
      if (props['restaurant']) {
        message += `<p><strong>Restaurant:</strong> ${props['restaurant']} (${props['mealType']})</p>`;
      }
      if (props['jeepneyRoute']) {
        const route = props['jeepneyRoute'];
        message += `<p><strong>🚌 Local Jeepney:</strong> Code ${route.jeepneyCode} (${route.estimatedTime})</p>`;
        message += `<p><strong>Route:</strong> ${route.from} → ${route.to}</p>`;
      }
      if (props['googleDirections']) {
        const directions = props['googleDirections'];
        message += `<p><strong>🗺️ Google Directions:</strong> ${directions.duration} (${directions.distance})</p>`;
      }
      if (props['description']) {
        message += `<p><strong>Notes:</strong> ${props['description']}</p>`;
      }
    } else if (props['type'] === 'hotel') {
      // Itinerary hotel event
      message += `<p><strong>Check-in:</strong> Evening</p>`;
      if (props['vicinity']) {
        message += `<p><strong>Location:</strong> ${props['vicinity']}</p>`;
      }
      if (props['description']) {
        message += `<p><strong>Notes:</strong> ${props['description']}</p>`;
      }
    } else {
      // Admin event
      if (props['time']) {
        message += `<p><strong>Time:</strong> ${props['time']}</p>`;
      }
      if (props['location']) {
        message += `<p><strong>Location:</strong> ${props['location']}</p>`;
      }
      if (props['description']) {
        message += `<p><strong>Description:</strong> ${props['description']}</p>`;
      }
    }
    
    message += '</div>';
    
    // Show event details in alert
    this.showEventAlert(event.title, message);
  }

  private async showEventAlert(title: string, message: string) {
    const alert = await this.alertCtrl.create({
      header: title,
      message: message,
      buttons: ['Close']
    });
    await alert.present();
  }

}
