import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { CalendarService, CalendarEvent } from '../../services/calendar.service';

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

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public datePipe: DatePipe,
    private calendarService: CalendarService
  ) {}

  ngOnInit() {
    this.loadEvents();
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      // Load all events from the calendar service
      const allEvents = await this.calendarService.loadItineraryEvents();
      
      // Filter for admin events only
      this.events = allEvents
        .filter(event => event.extendedProps?.isAdminEvent === true)
        .map(event => ({
          id: event.id,
          name: event.title,
          description: event.extendedProps?.description || '',
          date: event.start.split('T')[0],
          time: event.start.split('T')[1]?.substring(0, 5) || '',
          location: event.extendedProps?.location || '',
          spotId: event.extendedProps?.spotId || '',
          imageUrl: event.extendedProps?.imageUrl || '',
          createdAt: event.createdAt,
          updatedAt: event.extendedProps?.updatedAt
        }))
        .sort((a, b) => {
          // Sort by date descending, then by time
          const dateA = new Date(a.date + 'T' + a.time);
          const dateB = new Date(b.date + 'T' + b.time);
          return dateB.getTime() - dateA.getTime();
        });
      
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading events:', error);
      this.isLoading = false;
      this.showAlert('Error', 'Failed to load events');
    }
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
    console.log('EventList navigating to editor');
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
              // Delete from Firestore
              await this.firestore.collection('user_itinerary_events').doc(id).delete();
              
              // Remove from localStorage
              const currentEvents = JSON.parse(localStorage.getItem('user_itinerary_events') || '[]');
              const updatedEvents = currentEvents.filter((event: any) => event.id !== id);
              localStorage.setItem('user_itinerary_events', JSON.stringify(updatedEvents));
              
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
}
