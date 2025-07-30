import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { DatePipe } from '@angular/common';

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
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.loadEvents();
  }

  loadEvents() {
    this.isLoading = true;
    this.firestore.collection('events', ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (events) => {
          // Convert Firestore Timestamps to JS Dates
          this.events = events.map((event: any) => ({
            ...event,
            createdAt: event.createdAt && event.createdAt.toDate ? event.createdAt.toDate() : event.createdAt,
            updatedAt: event.updatedAt && event.updatedAt.toDate ? event.updatedAt.toDate() : event.updatedAt
          }));
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading events:', err);
          this.isLoading = false;
          this.showAlert('Error', 'Failed to load events');
        }
      });
  }

  refreshEvents() {
    this.loadEvents();
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
              await this.firestore.collection('events').doc(id).delete();
              this.showAlert('Success', 'Event deleted successfully');
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
