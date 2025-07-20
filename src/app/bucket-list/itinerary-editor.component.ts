import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList } from '@angular/cdk/drag-drop';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

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
                  <label>Start Time</label>
                  <input type="time" [(ngModel)]="settings.startTime" (change)="updateAllTimeSlots()" style="margin-bottom: 12px; width: 100%;" />
                </ion-item>
              </ion-col>
              <ion-col size="6">
                <ion-item>
                  <ion-label position="stacked">End Time</ion-label>
                  <label>End Time</label>
                  <input type="time" [(ngModel)]="settings.endTime" (change)="updateAllTimeSlots()" style="margin-bottom: 12px; width: 100%;" />
                </ion-item>
              </ion-col>
            </ion-row>
          </ion-grid>
          <ion-button expand="block" color="primary" (click)="updateAllTimeSlots()" class="ion-margin-top">
            Update All Time Slots
          </ion-button>
        </ion-card-content>
      </ion-card>

      <!-- Search Tourist Spots -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Search Tourist Spots</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Search</ion-label>
            <ion-input [(ngModel)]="searchQuery" placeholder="Type to search spots..."></ion-input>
          </ion-item>
          <div *ngIf="filteredSpots().length > 0">
            <div class="spot-card" *ngFor="let spot of filteredSpots()">
              <ion-item>
                <ion-avatar slot="start">
                  <img [src]="spot.img || 'assets/placeholder.jpg'" alt="{{ spot.name }}">
                </ion-avatar>
                <ion-label>
                  <h3>{{ spot.name }}</h3>
                  <p>{{ spot.category }}</p>
                </ion-label>
                <ion-button size="small" fill="outline" color="success" slot="end" (click)="addSpotToDay(spot)">
                  <ion-icon name="add"></ion-icon> Add to Day
                </ion-button>
              </ion-item>
            </div>
          </div>
          <div *ngIf="filteredSpots().length === 0 && searchQuery">
            <p>No spots found.</p>
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
                    <ng-container *ngIf="spot.chosenRestaurant">
                      <div class="restaurant-selected-card">
                        <ion-item color="light">
                          <ion-icon name="restaurant" slot="start" color="warning"></ion-icon>
                          <ion-label>
                            <h4>{{ spot.chosenRestaurant.name }}</h4>
                            <p *ngIf="spot.chosenRestaurant.vicinity">{{ spot.chosenRestaurant.vicinity }}</p>
                          </ion-label>
                          <ion-button size="small" fill="clear" color="danger" slot="end" (click)="spot.chosenRestaurant = undefined">
                            <ion-icon name="close"></ion-icon>
                          </ion-button>
                        </ion-item>
                      </div>
                    </ng-container>
                    <div class="time-section">
                      <label class="time-label">Time</label>
                      <input type="time"
                        [ngModel]="spot.timeSlot || settings.startTime"
                        (ngModelChange)="onSpotTimeInputChange(dayIndex, spotIndex, $event)"
                        style="margin-bottom: 8px; width: 100%; background: #fffbe6; color: #2d3748; border: 1px solid #ffd144; border-radius: 6px; font-weight: 600;" />
                      <ion-button size="small" fill="clear" color="medium" *ngIf="spot.customTime" (click)="resetSpotTime(dayIndex, spotIndex)">
                        <ion-icon name="refresh-outline"></ion-icon> Reset to Default
                      </ion-button>
                    </div>
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
      background: #fffbe6;
      border: 2px solid #ffc107;
      border-radius: 12px;
      margin-bottom: 24px;
      padding: 16px;
      overflow-x: auto;
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
      margin-bottom: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      padding: 8px 0;
      /* Remove overflow-x: auto; */
      min-height: 120px;
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
      margin-bottom: 32px;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.10);
      border: 2px solid #ffc107;
      /* Remove overflow-x: auto; */
      padding: 16px 12px 24px 12px;
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

    .restaurant-selected-card {
      background: #fff8e1;
      border: 2px solid #ffc107;
      border-radius: 12px;
      margin: 8px 0 16px 0;
      box-shadow: 0 2px 8px rgba(255,193,7,0.08);
    }
    .ion-padding {
      padding: 20px !important;
    }
    :host {
      --ion-background-color: #fffbe6;
    }
    ion-content {
      --background: #fffbe6;
    }
    ion-card, .day-card {
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.10);
      border: 2px solid #ffd144;
      margin-bottom: 32px;
      padding: 16px 12px 24px 12px;
    }
    ion-card-header, .day-card ion-card-header {
      background: linear-gradient(135deg, #ffe066, #ffd144);
      color: #2d3748;
      border-radius: 18px 18px 0 0;
      padding: 12px 16px;
    }
    ion-card-title, .day-card ion-card-title {
      color: #e67e22;
      font-weight: 700;
      font-size: 1.2rem;
    }
    .spot-card {
      margin-bottom: 20px;
      background: #fffbe6;
      border-radius: 14px;
      border: 1px solid #ffe066;
      box-shadow: 0 2px 8px rgba(255,193,7,0.08);
      padding: 12px 0;
      /* Remove overflow-x: auto; */
      min-height: 120px;
    }
    ion-item, .spot-card ion-item {
      --background: #fff;
      --border-radius: 12px;
      margin-bottom: 8px;
    }
    ion-input, ion-searchbar {
      --background: #fffbe6;
      --color: #2d3748;
      border-radius: 8px;
    }
    ion-button {
      --background: #ffd144;
      --color: #2d3748;
      font-weight: 600;
      border-radius: 8px;
    }
    ion-button[color="success"] {
      --background: #4caf50;
      --color: #fff;
    }
    ion-button[color="danger"] {
      --background: #e74c3c;
      --color: #fff;
    }
    ion-label, .category {
      color: #2d3748;
    }
    .restaurant-selected-card {
      background: #fffde7;
      border: 2px solid #ffd144;
      border-radius: 12px;
      margin: 8px 0 16px 0;
      box-shadow: 0 2px 8px rgba(255,193,7,0.08);
    }
    :host, ion-content, .day-card, ion-card, .spot-card, .restaurant-selected-card {
      color: #2d3748 !important;
    }
    ion-label, .category, .spot-card h3, .spot-card p, .restaurant-selected-card h4, .restaurant-selected-card p {
      color: #2d3748 !important;
    }
    ion-input, ion-searchbar {
      --color: #2d3748 !important;
      --placeholder-color: #2d3748 !important;
    }
    ion-button {
      --color: #fff !important;
    }
    ion-button[color="light"], ion-button[color="warning"] {
      --color: #2d3748 !important;
    }
    .day-card, ion-card, .spot-card, .restaurant-selected-card {
      border: 2px solid #ffd144 !important;
      background: #fff !important;
    }
    .time-section, .settings-time-col {
      margin-bottom: 12px;
      background: none;
      border-radius: 0;
      padding: 0;
    }
    .time-label {
      display: block;
      font-weight: 600;
      color: #e67e22;
      margin-bottom: 4px;
      font-size: 1rem;
    }
    .settings-time-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    .settings-time-col {
      flex: 1;
    }
    .time-display {
      font-size: 1.1rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 4px;
    }
    ion-datetime {
      --background: #fffbe6 !important;
      --color: #2d3748 !important;
      --placeholder-color: #2d3748 !important;
      border-radius: 8px;
      width: 100%;
      display: block;
    }
    .settings-time-col, .time-section {
      min-width: 260px;
    }
    .settings-time-row-fixed {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      justify-content: center;
    }
    .settings-time-col-fixed {
      min-width: 300px;
      max-width: 340px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .settings-time-col-fixed label {
      font-weight: 600;
      color: #e67e22;
      margin-bottom: 4px;
      font-size: 1rem;
    }
    .settings-time-col-fixed ion-datetime {
      width: 100%;
      min-width: 240px;
      max-width: 320px;
      --background: #fffbe6 !important;
      --color: #2d3748 !important;
      border-radius: 8px;
    }
    .settings-time-vertical {
      display: block;
      width: 350px;
      margin: 0 auto 16px auto;
    }
    .settings-time-col-fixed {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 12px;
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
  settings = { startTime: '08:00', endTime: '18:00' };
  dayLists: CdkDropList[] = [];
  allLists: (string | CdkDropList<any>)[] = [];
  allSpots: any[] = [];
  searchQuery: string = '';

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    if (!this.settings.startTime) this.settings.startTime = '08:00';
    if (!this.settings.endTime) this.settings.endTime = '18:00';
    // Deep copy the itinerary for editing
    this.editedItinerary = JSON.parse(JSON.stringify(this.itinerary));
    this.firestore.collection('tourist_spots').valueChanges({ idField: 'id' }).subscribe(spots => {
      this.allSpots = spots;
      this.calculateAvailableSpots();
      this.cdr.detectChanges();
    });
    
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
    this.availableSpots = this.allSpots.filter(spot => !assignedSpotIds.has(spot.id));
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
      if (!spot.customTime) {
        spot.timeSlot = this.formatTime(currentTime);
      }
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

  normalizeTimeValue(val: string | string[] | null | undefined): string {
    if (Array.isArray(val)) {
      return val[0] || '';
    }
    return val || '';
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
    let currentTime = this.parseTime(day.spots[startSpotIndex].timeSlot || this.settings.startTime);

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

  onSpotTimeInputChange(dayIndex: number, spotIndex: number, newTime: string) {
    const spot = this.editedItinerary[dayIndex].spots[spotIndex];
    spot.timeSlot = newTime;
    spot.customTime = true;
  }

  resetSpotTime(dayIndex: number, spotIndex: number) {
    const spot = this.editedItinerary[dayIndex].spots[spotIndex];
    spot.customTime = false;
    this.updateTimeSlots(dayIndex);
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  filteredSpots() {
    const assignedSpotIds = new Set<string>();
    this.editedItinerary.forEach(day => {
      if (day && day.spots) {
        day.spots.forEach(spot => assignedSpotIds.add(spot.id));
      }
    });
    return this.allSpots.filter(spot =>
      !assignedSpotIds.has(spot.id) &&
      (!this.searchQuery || spot.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );
  }

  async addSpotToDay(spot: any) {
    if (this.editedItinerary.length === 1) {
      this.editedItinerary[0].spots.push(JSON.parse(JSON.stringify(spot)));
      this.calculateAvailableSpots();
      this.updateAllTimeSlots();
      this.cdr.detectChanges();
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Add to which day?',
      inputs: this.editedItinerary.map((day, idx) => ({
        name: `day${day.day}`,
        type: 'radio',
        label: `Day ${day.day}`,
        value: idx,
        checked: idx === 0
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Add', handler: (dayIdx: number) => {
          if (typeof dayIdx === 'number' && this.editedItinerary[dayIdx]) {
            this.editedItinerary[dayIdx].spots.push(JSON.parse(JSON.stringify(spot)));
            this.calculateAvailableSpots();
            this.updateAllTimeSlots();
            this.cdr.detectChanges();
          }
        }}
      ]
    });
    await alert.present();
  }

  formatTimeDisplay(time: string | undefined): string {
    if (!time) return '';
    const date = new Date(`1970-01-01T${time}`);
    if (isNaN(date.getTime())) return time;
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const mins = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${mins} ${ampm}`;
  }

  // Add a helper to format time as 'HH:mm':
  formatTimeForPicker(time: string | undefined): string {
    if (!time) return '08:00';
    // If already in HH:mm, return as is
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    // If in HH, add :00
    if (/^\d{2}$/.test(time)) return time + ':00';
    // If in ISO or other, try to extract time
    const match = time.match(/(\d{2}:\d{2})/);
    return match ? match[1] : '08:00';
  }
} 