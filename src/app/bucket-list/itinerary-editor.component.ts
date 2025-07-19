import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList } from '@angular/cdk/drag-drop';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';

@Component({
  selector: 'app-itinerary-editor',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Edit Itinerary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="saveChanges()" color="success">
            <ion-icon name="checkmark"></ion-icon>
          </ion-button>
          <ion-button (click)="cancel()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Settings Panel -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Itinerary Settings</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="6">
                <ion-item>
                  <ion-label position="stacked">Start Time</ion-label>
                  <ion-datetime 
                    presentation="time"
                    [(ngModel)]="settings.startTime"
                    (ionChange)="updateAllTimeSlots()">
                  </ion-datetime>
                </ion-item>
              </ion-col>
              <ion-col size="6">
                <ion-item>
                  <ion-label position="stacked">End Time</ion-label>
                  <ion-datetime 
                    presentation="time"
                    [(ngModel)]="settings.endTime"
                    (ionChange)="updateAllTimeSlots()">
                  </ion-datetime>
                </ion-item>
              </ion-col>
            </ion-row>
          </ion-grid>
          <ion-button expand="block" color="primary" (click)="updateAllTimeSlots()" class="ion-margin-top">
            Update All Time Slots
          </ion-button>
        </ion-card-content>
      </ion-card>

      <!-- Available Spots -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Available Tourist Spots</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div cdkDropList
               #availableList="cdkDropList"
               [cdkDropListData]="availableSpots"
               [cdkDropListConnectedTo]="dayLists"
               class="drop-list available-drop-list"
               (cdkDropListDropped)="drop($event)">
            <div class="spot-card" *ngFor="let spot of availableSpots" cdkDrag>
              <ion-item>
                <ion-avatar slot="start">
                  <img [src]="spot.img || 'assets/placeholder.jpg'" alt="{{ spot.name }}">
                </ion-avatar>
                <ion-label>
                  <h3>{{ spot.name }}</h3>
                  <p>{{ spot.category }}</p>
                </ion-label>
                <ion-icon name="move" slot="end" color="medium"></ion-icon>
              </ion-item>
            </div>
            <div *ngIf="availableSpots.length === 0" class="empty-message">
              <ion-icon name="basket-outline" size="large" color="medium"></ion-icon>
              <p>No available tourist spots</p>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Days -->
      <div class="days-section">
        <ion-card *ngFor="let day of editedItinerary; let dayIndex = index" class="day-card">
          <ion-card-header>
            <ion-card-title>Day {{ day.day }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div cdkDropList
                 #dayList="cdkDropList"
                 [cdkDropListData]="day.spots"
                 [cdkDropListConnectedTo]="allLists"
                 class="drop-list day-drop-list"
                 (cdkDropListDropped)="drop($event)">
              <div class="spot-card" *ngFor="let spot of day.spots; let spotIndex = index" cdkDrag>
                <ion-item>
                  <ion-avatar slot="start">
                    <img [src]="spot.img || 'assets/placeholder.jpg'" alt="{{ spot.name }}">
                  </ion-avatar>
                  <ion-label>
                    <h3>{{ spot.name }}</h3>
                    <p class="time-slot">⏰ {{ spot.timeSlot }}</p>
                    <p class="category">{{ spot.category }}</p>
                  </ion-label>
                  <ion-icon name="move" slot="end" color="medium"></ion-icon>
                </ion-item>
                <ion-item>
                  <ion-label position="stacked">Duration (minutes)</ion-label>
                  <ion-input 
                    type="number" 
                    min="30" 
                    max="480"
                    [(ngModel)]="spot.durationMinutes"
                    (ionChange)="updateTimeSlots(dayIndex)"
                    placeholder="120">
                  </ion-input>
                  <ion-button 
                    size="small" 
                    fill="clear" 
                    color="primary" 
                    slot="end"
                    (click)="editSpotTime(dayIndex, spotIndex)">
                    <ion-icon name="time"></ion-icon>
                  </ion-button>
                  <ion-button 
                    size="small" 
                    fill="clear" 
                    color="danger" 
                    slot="end"
                    (click)="removeSpot(dayIndex, spotIndex)">
                    <ion-icon name="trash"></ion-icon>
                  </ion-button>
                </ion-item>
              </div>
              <div *ngIf="day.spots.length === 0" class="empty-message">
                <ion-icon name="calendar-outline" size="large" color="medium"></ion-icon>
                <p>Drag spots here</p>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    .drop-list {
      min-height: 100px;
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 12px;
      background: #f8f9fa;
      transition: all 0.3s ease;
    }

    .drop-list:hover {
      border-color: #007bff;
      background: #f0f8ff;
    }

    .available-drop-list {
      min-height: 150px;
    }

    .day-drop-list {
      min-height: 200px;
    }

    .spot-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      margin-bottom: 12px;
      cursor: move;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
    }

    .spot-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateY(-2px);
    }

    .spot-card ion-item {
      --padding-start: 0;
      --inner-padding-end: 0;
    }

    .spot-card ion-item:first-child {
      border-bottom: 1px solid #f0f0f0;
    }

    .time-slot {
      color: #007bff;
      font-weight: 500;
      margin: 4px 0;
    }

    .category {
      color: #666;
      font-size: 0.9rem;
      text-transform: uppercase;
      font-weight: 500;
    }

    .empty-message {
      text-align: center;
      color: #999;
      padding: 40px 20px;
    }

    .empty-message ion-icon {
      margin-bottom: 12px;
    }

    .empty-message p {
      margin: 0;
      font-size: 0.9rem;
    }

    .days-section {
      margin-top: 20px;
    }

    .day-card {
      margin-bottom: 20px;
    }

    .day-card ion-card-header {
      background: linear-gradient(135deg, #ffc107, #ff9800);
      color: white;
    }

    .day-card ion-card-title {
      color: white;
      font-weight: 600;
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
      transform: rotate(5deg);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
      background: #e3f2fd;
      border: 2px dashed #2196f3;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .drop-list.cdk-drop-list-dragging .spot-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    ion-avatar {
      width: 40px;
      height: 40px;
    }

    ion-avatar img {
      object-fit: cover;
    }
  `],
  standalone: false
})
export class ItineraryEditorComponent implements OnInit, AfterViewInit {
  @Input() itinerary: ItineraryDay[] = [];
  @Input() availableSpots: any[] = [];
  @Output() itinerarySaved = new EventEmitter<ItineraryDay[]>();
  @ViewChildren(CdkDropList) dropLists!: QueryList<CdkDropList>;

  editedItinerary: ItineraryDay[] = [];
  settings = { startTime: '1970-01-01T08:00', endTime: '1970-01-01T18:00' };
  dayLists: CdkDropList[] = [];
  allLists: (string | CdkDropList<any>)[] = [];

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Deep copy the itinerary for editing
    this.editedItinerary = JSON.parse(JSON.stringify(this.itinerary));
    
    // Initialize duration for each spot
    this.editedItinerary.forEach(day => {
      if (day && day.spots) {
        day.spots.forEach(spot => {
          if (!spot.durationMinutes) {
            spot.durationMinutes = 120; // Default 2 hours
          }
        });
      }
    });

    // Calculate available spots (spots not assigned to any day)
    this.calculateAvailableSpots();

    // Delay time slot updates to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.updateAllTimeSlots();
    }, 0);
  }

  private calculateAvailableSpots() {
    // Get all assigned spot IDs
    const assignedSpotIds = new Set<string>();
    this.editedItinerary.forEach(day => {
      if (day && day.spots) {
        day.spots.forEach(spot => {
          assignedSpotIds.add(spot.id);
        });
      }
    });

    // Filter available spots to show only unassigned spots
    this.availableSpots = this.availableSpots.filter(spot => !assignedSpotIds.has(spot.id));
  }

  ngAfterViewInit() {
    // Get all drop lists and set up connectivity
    setTimeout(() => {
      this.dayLists = this.dropLists.toArray();
      this.allLists = this.dayLists;
      this.cdr.detectChanges();
    }, 0);
  }

  drop(event: CdkDragDrop<any[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    
    // Update time slots for all days after any drag operation
    setTimeout(() => {
      this.updateAllTimeSlots();
    }, 0);
  }

  private getDayIndex(container: any): number {
    return this.dayLists.indexOf(container);
  }

  removeSpot(dayIndex: number, spotIndex: number) {
    const spot = this.editedItinerary[dayIndex].spots[spotIndex];
    this.availableSpots.push(spot);
    this.editedItinerary[dayIndex].spots.splice(spotIndex, 1);
    setTimeout(() => {
      this.updateTimeSlots(dayIndex);
    }, 0);
  }

  updateTimeSlots(dayIndex: number) {
    const day = this.editedItinerary[dayIndex];
    if (!day || !day.spots) {
      return; // Guard against undefined
    }
    
    const startTime = this.parseTime(this.settings.startTime);
    let currentTime = new Date(startTime);

    day.spots.forEach(spot => {
      spot.timeSlot = this.formatTime(currentTime);
      const endTime = new Date(currentTime.getTime() + (spot.durationMinutes || 120) * 60000);
      spot.estimatedDuration = `${spot.durationMinutes || 120} min`;
      currentTime = endTime;
    });
    
    this.cdr.detectChanges();
  }

  updateAllTimeSlots() {
    this.editedItinerary.forEach((day, dayIndex) => {
      if (day && day.spots) {
        this.updateTimeSlots(dayIndex);
      }
    });
  }

  private parseTime(time: string): Date {
    // Handle ISO format strings (e.g., "1970-01-01T08:00")
    if (time.includes('T')) {
      return new Date(time);
    }
    // Handle simple time strings (e.g., "08:00")
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  async saveChanges() {
    // Validate that all spots are assigned
    const totalAssignedSpots = this.editedItinerary.reduce((sum, day) => sum + day.spots.length, 0);
    const totalSpots = this.availableSpots.length + totalAssignedSpots;
    
    if (totalAssignedSpots === 0) {
      this.showAlert('No Spots Assigned', 'Please assign at least one spot to your itinerary.');
      return;
    }

    // Remove empty days
    this.editedItinerary = this.editedItinerary.filter(day => day.spots.length > 0);
    
    // Re-number days
    this.editedItinerary.forEach((day, index) => {
      day.day = index + 1;
    });

    this.itinerarySaved.emit(this.editedItinerary);
    this.modalCtrl.dismiss(this.editedItinerary);
  }

  cancel() {
    this.modalCtrl.dismiss();
  }

  async editSpotTime(dayIndex: number, spotIndex: number) {
    const spot = this.editedItinerary[dayIndex].spots[spotIndex];
    const currentTime = spot.timeSlot || '08:00';
    
    const alert = await this.alertCtrl.create({
      header: 'Edit Time for ' + spot.name,
      inputs: [
        {
          name: 'time',
          type: 'time',
          value: currentTime,
          placeholder: 'Select time'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: (data) => {
            if (data.time) {
              spot.timeSlot = data.time;
              // Recalculate times for this day starting from the edited spot
              this.recalculateTimesFromSpot(dayIndex, spotIndex);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private recalculateTimesFromSpot(dayIndex: number, startSpotIndex: number) {
    const day = this.editedItinerary[dayIndex];
    if (!day || !day.spots) return;

    // Start from the edited spot's time
    let currentTime = this.parseTime(day.spots[startSpotIndex].timeSlot);

    // Update times for all spots from the edited spot onwards
    for (let i = startSpotIndex; i < day.spots.length; i++) {
      const spot = day.spots[i];
      spot.timeSlot = this.formatTime(currentTime);
      const endTime = new Date(currentTime.getTime() + (spot.durationMinutes || 120) * 60000);
      spot.estimatedDuration = `${spot.durationMinutes || 120} min`;
      currentTime = endTime;
    }

    this.cdr.detectChanges();
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