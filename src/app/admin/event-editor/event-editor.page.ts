import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { CalendarService, GlobalEvent } from '../../services/calendar.service';

@Component({
  selector: 'app-event-editor',
  templateUrl: './event-editor.page.html',
  styleUrls: ['./event-editor.page.scss'],
  standalone: false,
})
export class EventEditorPage implements OnInit {
  // Event properties
  eventName: string = '';
  eventDescription: string = '';
  eventDate: string = '';
  eventTime: string = '';
  eventEndTime: string = '';
  eventLocation: string = '';
  selectedSpotId: string = '';
  imageFile?: File;
  imageUrl: string = '';
  originalImageUrl: string = '';
  isUploading: boolean = false;
  uploadProgress: number = 0;
  
  // Tourist spots for location selection
  touristSpots: any[] = [];
  filteredTouristSpots: any[] = [];
  loadingSpots: boolean = false;
  spotPickerOpen = false;
  spotSearchQuery = '';
  
  // Edit mode tracking
  isEditing: boolean = false;
  editingEventId: string = '';

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private storageService: StorageService,
    private authService: AuthService,
    private calendarService: CalendarService
  ) {}

  async ngOnInit() {
    // Check if user is authenticated as admin
    const isAdmin = await this.authService.isAdmin();
    if (!isAdmin) {
      this.showAlert('Access Denied', 'You must be logged in as an admin to create events.');
      this.navCtrl.navigateBack('/admin/login');
      return;
    }

    this.loadTouristSpots();
    
    // Check for edit mode
    const nav = window.history.state;
    if (nav && nav.eventToEdit) {
      const event = nav.eventToEdit;
      this.isEditing = true;
      this.editingEventId = event.id;
      this.eventName = event.name || '';
      this.eventDescription = event.description || '';
      this.eventDate = event.date || '';
      this.eventTime = event.time || '';
      this.eventEndTime = event.endTime || '';
      this.eventLocation = event.location || '';
      this.selectedSpotId = event.spotId || '';
      this.imageUrl = event.imageUrl || '';
      this.originalImageUrl = event.imageUrl || '';
    } else {
      this.isEditing = false;
      this.editingEventId = '';
      // Set default date to today
      const today = new Date();
      this.eventDate = today.toISOString().split('T')[0];
    }
  }

  async loadTouristSpots() {
    try {
      this.loadingSpots = true;
      const spotsSnapshot = await this.firestore.collection('tourist_spots').get().toPromise();
      this.touristSpots = spotsSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];
      
      // Sort spots by name
      this.touristSpots.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error loading tourist spots:', error);
      this.touristSpots = [];
      this.filteredTouristSpots = [];
      this.showAlert('Error', 'Failed to load tourist spots');
    } finally {
      this.loadingSpots = false;
      this.applySpotFilter();
    }
  }

  openSpotPicker(): void {
    this.spotSearchQuery = '';
    this.applySpotFilter();
    this.spotPickerOpen = true;
  }

  closeSpotPicker(): void {
    this.spotPickerOpen = false;
  }

  onSpotPickerDismiss(): void {
    this.spotPickerOpen = false;
  }

  applySpotFilter(): void {
    const raw = (this.spotSearchQuery || '').trim().toLowerCase();
    if (!raw) {
      this.filteredTouristSpots = [...this.touristSpots];
      return;
    }
    this.filteredTouristSpots = this.touristSpots.filter((s) => {
      const name = String(s?.name || '').toLowerCase();
      const category = String(s?.category || '').toLowerCase();
      const desc = String(s?.description || '').toLowerCase();
      return name.includes(raw) || category.includes(raw) || desc.includes(raw);
    });
  }

  selectSpotFromPicker(spot: any): void {
    if (!spot?.id) {
      return;
    }
    this.selectedSpotId = spot.id;
    this.eventLocation = spot.name || '';
    this.closeSpotPicker();
  }

  getSelectedSpotDisplayName(): string {
    if (!this.selectedSpotId) {
      return 'Search & select tourist spot';
    }
    const selected = this.touristSpots.find((s) => s.id === this.selectedSpotId);
    return selected?.name || this.eventLocation || 'Selected spot';
  }

  trackSpotById(_index: number, spot: any): string {
    return spot?.id || String(_index);
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFile = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.imageFile = undefined;
    this.imageUrl = '';
  }

  private async uploadImage(): Promise<string> {
    // If no new image is selected and we're editing
    if (!this.imageFile) {
      // If we're editing and the image was removed, delete the original
      if (this.isEditing && this.originalImageUrl && !this.imageUrl) {
        await this.storageService.deleteFileByURL(this.originalImageUrl);
        return ''; // Return empty string for no image
      }
      return this.imageUrl || '';
    }
    
    this.isUploading = true;
    this.uploadProgress = 0;
    const filePath = `events/${Date.now()}_${this.imageFile.name}`;
    
    try {
      const url = await this.storageService.uploadFile(filePath, this.imageFile);
      
      // If we're editing and there was a previous image, delete it
      if (this.isEditing && this.originalImageUrl && this.originalImageUrl !== url) {
        await this.storageService.deleteFileByURL(this.originalImageUrl);
        }
      
      return url;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    } finally {
      this.isUploading = false;
      this.uploadProgress = 100;
    }
  }

  async saveEvent() {
    // Check if user is still authenticated as admin
    const isAdmin = await this.authService.isAdmin();
    if (!isAdmin) {
      this.showAlert('Access Denied', 'You must be logged in as an admin to create events.');
      this.navCtrl.navigateBack('/admin/login');
      return;
    }

    if (!this.eventName.trim()) {
      this.showAlert('Error', 'Please enter an event name');
      return;
    }

    if (!this.eventDate) {
      this.showAlert('Error', 'Please select an event date');
      return;
    }

    if (!this.eventTime) {
      this.showAlert('Error', 'Please select an event time');
      return;
    }

    if (!this.eventEndTime) {
      this.showAlert('Error', 'Please select an end time');
      return;
    }

    if (this.compareTimeStrings(this.eventEndTime, this.eventTime) <= 0) {
      this.showAlert('Error', 'End time must be after start time');
      return;
    }

    if (!this.selectedSpotId) {
      this.showAlert('Error', 'Please select an event location');
      return;
    }
    
    try {
      const imageUrl = await this.uploadImage();
      
      // Create GlobalEvent structure
      const globalEvent: Omit<GlobalEvent, 'id' | 'createdAt' | 'createdBy'> = {
        name: this.eventName.trim(),
        description: this.eventDescription.trim(),
        date: this.eventDate,
        time: this.eventTime,
        endTime: this.eventEndTime,
        location: this.eventLocation.trim(),
        spotId: this.selectedSpotId,
        imageUrl: imageUrl,
        createdByType: 'admin',
        eventType: 'admin_event',
        status: 'active'
      };

      if (this.isEditing && this.editingEventId) {
        // Update existing event
        await this.calendarService.updateGlobalEvent(this.editingEventId, {
          ...globalEvent,
          updatedAt: new Date()
        });
      } else {
        // Create new admin event
        const eventId = await this.calendarService.saveGlobalEvent(globalEvent);
        }

      this.showAlert('Success', `Event ${this.isEditing ? 'updated' : 'created'} successfully`);
      this.navCtrl.navigateBack(this.isEditing ? '/admin/event-list' : '/admin/dashboard');
    } catch (error) {
      console.error('Error saving event:', error);
      this.showAlert('Error', 'Failed to save event');
    }
  }

  clearEvent() {
    this.eventName = '';
    this.eventDescription = '';
    this.eventDate = '';
    this.eventTime = '';
    this.eventEndTime = '';
    this.eventLocation = '';
    this.selectedSpotId = '';
    this.spotSearchQuery = '';
    this.applySpotFilter();
    this.imageFile = undefined;
    this.imageUrl = '';
    this.originalImageUrl = '';
    
    // Set default date to today
    const today = new Date();
    this.eventDate = today.toISOString().split('T')[0];
  }

  /** Lexicographic compare works for normalized HH:mm from ion-input[type=time]. */
  private compareTimeStrings(a: string, b: string): number {
    return String(a).localeCompare(String(b));
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
