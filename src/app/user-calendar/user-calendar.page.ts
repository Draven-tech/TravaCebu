import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';

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
    private alertCtrl: AlertController
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

  loadEvents() {
    this.firestore.collection('events', ref => ref.orderBy('date', 'asc'))
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (events) => {
          // Convert admin events to FullCalendar format
          const calendarEvents = events.map((event: any) => ({
            id: event.id,
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
              imageUrl: event.imageUrl
            }
          }));
          
          // Update calendar with events
          this.calendarOptions.events = calendarEvents;
          
          // Force calendar refresh
          if (this.calendarComponent) {
            this.calendarComponent.getApi().refetchEvents();
          }
        },
        error: (error) => {
          console.error('Error loading events:', error);
        }
      });
  }

  handleEventClick(clickInfo: EventClickArg) {
    const event = clickInfo.event;
    const props = event.extendedProps;
    
    // Create event details message
    let message = `<div style="text-align: left;">
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${event.startStr}</p>`;
    
    if (props['time']) {
      message += `<p><strong>Time:</strong> ${props['time']}</p>`;
    }
    
    if (props['location']) {
      message += `<p><strong>Location:</strong> ${props['location']}</p>`;
    }
    
    if (props['description']) {
      message += `<p><strong>Description:</strong> ${props['description']}</p>`;
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
