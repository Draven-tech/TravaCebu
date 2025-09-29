import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList } from '@angular/cdk/drag-drop';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';

@Component({
  selector: 'app-itinerary-editor',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title style="font-size: 1.2rem; font-weight: 700;">
          <ion-icon name="create-outline" style="margin-right: 8px;"></ion-icon>
          Edit Itinerary
        </ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="saveChanges()" fill="solid" color="success" size="small">
            <ion-icon name="checkmark-circle" slot="start"></ion-icon>
            Save
          </ion-button>
          <ion-button (click)="cancel()" fill="clear">
            <ion-icon name="close" style="font-size: 20px;"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding compact-modal">
      <!-- Combined Settings -->
      <ion-item lines="none" class="compact-settings">
        <ion-label>
          <h3>âš™ï¸ Settings</h3>
        </ion-label>
        <ion-button size="small" fill="clear" (click)="updateAllTimeSlots()">
          <ion-icon name="refresh"></ion-icon>
        </ion-button>
      </ion-item>
      
      <!-- Date Settings -->
      <ion-item lines="none" class="date-header">
        <ion-label>
          <h3>ðŸ“… Edit Dates</h3>
        </ion-label>
        <ion-button size="small" fill="clear" (click)="updateAllDates()">
          <ion-icon name="refresh"></ion-icon>
        </ion-button>
      </ion-item>
       
                               <ion-item lines="none" class="compact-time-item">
           <ion-label position="stacked">Start Date</ion-label>
           <ion-input 
             type="date"
             [(ngModel)]="startDate"
             (ionChange)="updateAllDates()"
             class="compact-time-input">
           </ion-input>
         </ion-item>
       
               <ion-item lines="none" class="compact-time-item">
          <ion-label position="stacked">Number of Days</ion-label>
          <ion-input 
            type="number" 
            min="1" 
            max="14"
            [(ngModel)]="numberOfDays"
            (ionChange)="updateNumberOfDays()"
            placeholder="1"
            class="compact-input">
          </ion-input>
        </ion-item>
       
                       <!-- Time Settings -->
         <ion-item lines="none" class="compact-time-item">
           <ion-label position="stacked">Start Time</ion-label>
           <ion-input 
             type="time"
             [(ngModel)]="settings.startTime"
             (ionChange)="updateAllTimeSlots()"
             class="compact-time-input">
           </ion-input>
         </ion-item>
         
         <ion-item lines="none" class="compact-time-item">
           <ion-label position="stacked">End Time</ion-label>
           <ion-input 
             type="time"
             [(ngModel)]="settings.endTime"
             (ionChange)="updateAllTimeSlots()"
             class="compact-time-input">
           </ion-input>
         </ion-item>

       <!-- Compact Days -->
       <div class="compact-days">
         <ion-card *ngFor="let day of editedItinerary; let dayIndex = index" class="compact-day-card">
           <ion-card-header class="compact-header">
             <ion-card-title>
               Day {{ day.day }}
               <span class="day-date" *ngIf="day.date">{{ formatDateDisplay(day.date) }}</span>
             </ion-card-title>
             <ion-button size="small" fill="clear" color="danger" (click)="removeAllSpotsFromDay(dayIndex)" *ngIf="day.spots.length > 0">
               <ion-icon name="trash"></ion-icon>
             </ion-button>
           </ion-card-header>
           <ion-card-content class="compact-content">
             <div cdkDropList
                  #dayList="cdkDropList"
                  [cdkDropListData]="day.spots"
                  [cdkDropListConnectedTo]="allLists"
                  class="drop-list compact-day-drop-list"
                  (cdkDropListDropped)="drop($event)">
               <div class="compact-spot-item" *ngFor="let spot of day.spots; let spotIndex = index" cdkDrag>
                 <ion-avatar slot="start">
                   <img [src]="spot.img || 'assets/placeholder.jpg'" alt="{{ spot.name }}">
                 </ion-avatar>
                                   <ion-label>
                    <h4>{{ spot.name }}</h4>
                    <p class="time-slot">{{ spot.timeSlot }}</p>
                  </ion-label>
                 <div class="compact-actions">
                   <ion-input 
                     type="number" 
                     min="30" 
                     max="480"
                     [(ngModel)]="spot.durationMinutes"
                     (ionChange)="updateTimeSlots(dayIndex)"
                     placeholder="120"
                     class="duration-input">
                   </ion-input>
                   <ion-button 
                     size="small" 
                     fill="clear" 
                     color="danger" 
                     (click)="removeSpot(dayIndex, spotIndex)">
                     <ion-icon name="close"></ion-icon>
                   </ion-button>
                 </div>
               </div>
                               <div *ngIf="day.spots.length === 0" class="empty-message">
                  <ion-icon name="calendar-outline" size="small" color="primary"></ion-icon>
                  <p>Drop spots here</p>
                </div>
             </div>
           </ion-card-content>
         </ion-card>
       </div>
     </ion-content>
  `,
     styles: [`
           .compact-modal {
        --padding-start: 4px;
        --padding-end: 4px;
        --padding-top: 4px;
        --padding-bottom: 4px;
      }

      .compact-settings {
        --background: #ffffff;
        border-radius: 6px;
        margin-bottom: 6px;
        border: 1px solid #e0e0e0;
      }

      .compact-settings h3 {
        color: #333;
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0;
      }

      .date-header {
        --background: #1976d2;
        border-radius: 6px;
        margin-bottom: 6px;
      }

      .date-header h3 {
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0;
        color: white;
      }

      .day-date {
        color: #fff;
        font-size: 0.65rem;
        font-weight: 400;
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 4px;
        border-radius: 3px;
        margin-left: 4px;
        display: inline-block;
      }

      .section-header {
        --background: #f5f5f5;
        border-radius: 6px;
        margin: 6px 0;
        border: 1px solid #e0e0e0;
      }

      .section-header h3 {
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0;
        color: #333;
      }

                  .compact-drop-list {
         min-height: 80px;
         max-height: 140px;
         overflow-y: auto;
         border: 1px dashed #ccc;
         border-radius: 6px;
         padding: 8px;
         background: #ffffff;
         margin-bottom: 8px;
       }

       .compact-day-drop-list {
         min-height: 70px;
         max-height: 200px;
         overflow-y: auto;
         border: 1px dashed #ccc;
         border-radius: 6px;
         padding: 8px;
         background: #ffffff;
         margin-top: 6px;
       }

      .compact-day-drop-list:empty {
        min-height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f9fa;
      }

           .compact-spot-item {
        display: flex;
        align-items: center;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        margin-bottom: 6px;
        padding: 6px;
        cursor: move;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
      }

      .compact-spot-item:hover {
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        transform: translateY(-1px);
      }

      .compact-spot-item ion-avatar {
        width: 24px;
        height: 24px;
        margin-right: 8px;
      }

      .compact-spot-item ion-label {
        flex: 1;
        margin: 0;
      }

      .compact-spot-item h4 {
        font-size: 0.8rem;
        font-weight: 600;
        margin: 0 0 2px 0;
        color: #333;
      }

      .compact-spot-item p {
        font-size: 0.7rem;
        margin: 0;
        color: #666;
      }

      .time-slot {
        color: #007bff;
        font-weight: 500;
        font-size: 0.65rem;
        margin: 0;
        opacity: 0.8;
      }

           .compact-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .duration-input {
        width: 45px;
        --padding-start: 2px;
        --padding-end: 2px;
        font-size: 0.6rem;
        --border-radius: 3px;
        --min-height: 24px;
      }

           .compact-days {
        margin-top: 6px;
      }

      .compact-day-card {
        margin-bottom: 6px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      .compact-header {
        background: linear-gradient(135deg, #ffc107, #ff9800);
        color: white;
        padding: 6px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .compact-header ion-card-title {
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
        margin: 0;
      }

            .compact-content {
        padding: 6px;
      }

      .compact-time-item {
        --min-height: 35px;
        --padding-start: 4px;
        --padding-end: 4px;
        --padding-top: 1px;
        --padding-bottom: 1px;
        margin-bottom: 1px;
      }

      .compact-time-item ion-label {
        font-size: 0.65rem;
        margin-bottom: 1px;
        --color: #666;
      }

      .compact-time-input {
        --height: 28px;
        --min-height: 28px;
        --max-height: 28px;
        font-size: 0.75rem;
        --padding-start: 4px;
        --padding-end: 4px;
        --border-radius: 3px;
        --border: 1px solid #ddd;
      }

      .compact-input {
        --height: 28px;
        --min-height: 28px;
        --max-height: 28px;
        font-size: 0.75rem;
        --padding-start: 4px;
        --padding-end: 4px;
        --border-radius: 3px;
        --border: 1px solid #ddd;
      }

            .empty-message {
        text-align: center;
        color: #666;
        padding: 8px 4px;
        font-size: 0.65rem;
      }

      .empty-message ion-icon {
        margin-bottom: 2px;
        color: #007bff;
      }

      .empty-message p {
        margin: 0;
        font-size: 0.65rem;
        color: #666;
      }

     .cdk-drag-preview {
       box-sizing: border-box;
       border-radius: 6px;
       box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
       transform: rotate(2deg);
     }

     .cdk-drag-placeholder {
       opacity: 0.3;
       background: #e3f2fd;
       border: 1px dashed #2196f3;
     }

     .cdk-drag-animating {
       transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
     }

     .drop-list.cdk-drop-list-dragging .compact-spot-item:not(.cdk-drag-placeholder) {
       transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
     }

     ion-avatar img {
       object-fit: cover;
     }

     .modern-edit-content {
       background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
       --padding-start: 16px;
       --padding-end: 16px;
       --padding-top: 16px;
       --padding-bottom: 16px;
     }

     .settings-card {
       background: rgba(255, 255, 255, 0.95);
       backdrop-filter: blur(10px);
       border-radius: 16px;
       box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
       margin-bottom: 20px;
       border: 1px solid rgba(255, 255, 255, 0.2);
     }

     .settings-title {
       display: flex;
       align-items: center;
       gap: 12px;
       color: #2D3748;
       font-size: 1.1rem;
       font-weight: 700;
     }

     .settings-section {
       margin-bottom: 24px;
     }

     .section-header {
       display: flex;
       justify-content: space-between;
       align-items: center;
       margin-bottom: 16px;
       padding-bottom: 12px;
       border-bottom: 2px solid #f1f3f4;
     }

     .section-title {
       display: flex;
       align-items: center;
       gap: 8px;
       color: #2D3748;
       font-size: 1rem;
       font-weight: 600;
       margin: 0;
     }

     .modern-form-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
       gap: 16px;
     }

     .form-group {
       background: rgba(255, 255, 255, 0.8);
       border-radius: 12px;
       padding: 16px;
       border: 1px solid rgba(0, 0, 0, 0.1);
     }

     .modern-input-item {
       --background: transparent;
       --border-radius: 8px;
       --padding-start: 0;
       --padding-end: 0;
     }

     .modern-input {
       --background: rgba(255, 255, 255, 0.9);
       --border-radius: 8px;
       --padding-start: 12px;
       --padding-end: 12px;
       border: 1px solid #e2e8f0;
       margin-top: 8px;
     }

     .modern-input:focus {
       --border-color: #f39c12;
       box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.1);
     }

     .compact-modal {
       background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%);
     }

     .compact-settings, .date-header {
       background: rgba(255, 255, 255, 0.95);
       border-radius: 12px;
       margin: 12px 0;
       --padding-start: 16px;
       --padding-end: 16px;
       box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
       --color: #2D3748;
     }

     .compact-settings ion-label h3,
     .date-header ion-label h3 {
       color: #2D3748 !important;
       font-weight: 700;
       margin: 8px 0;
     }

     .compact-time-item {
       background: rgba(255, 255, 255, 0.9);
       border-radius: 8px;
       margin: 8px 0;
       --padding-start: 12px;
       --padding-end: 12px;
       --color: #2D3748;
     }

     .compact-time-item ion-label {
       color: #2D3748 !important;
       font-weight: 600;
     }

     .compact-time-input, .compact-input {
       --background: rgba(255, 255, 255, 0.95);
       --border-radius: 6px;
       --color: #2D3748;
       border: 1px solid #e2e8f0;
       font-weight: 600;
     }

     .compact-time-input:focus, .compact-input:focus {
       border-color: #f39c12;
       box-shadow: 0 0 0 3px rgba(241, 196, 15, 0.2);
     }

     .section-header {
       background: rgba(255, 255, 255, 0.95);
       border-radius: 12px;
       margin: 16px 0 12px 0;
       --padding-start: 16px;
       --padding-end: 16px;
       box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
     }

     .compact-day-card {
       background: rgba(255, 255, 255, 0.95);
       border-radius: 16px;
       margin: 16px 0;
       padding: 16px;
       box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
       border: 1px solid rgba(255, 255, 255, 0.3);
     }

     .compact-header {
       --color: #2D3748;
       padding-bottom: 12px;
       border-bottom: 2px solid #f1c40f;
     }

     .compact-header ion-card-title {
       color: #e74c3c !important;
       font-size: 1.2rem;
       font-weight: 700;
       display: flex;
       align-items: center;
       gap: 8px;
     }

     .compact-spot-item {
       background: rgba(255, 255, 255, 0.9);
       border-radius: 12px;
       margin: 8px 0;
       box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
       border: 1px solid rgba(0, 0, 0, 0.05);
       transition: all 0.3s ease;
       --color: #2D3748;
     }

     .compact-spot-item:hover {
       transform: translateY(-2px);
       box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
     }

     .compact-spot-item ion-label {
       color: #2D3748 !important;
     }

     .compact-spot-item ion-label h4 {
       color: #2D3748 !important;
       font-weight: 600;
       margin: 4px 0;
     }

     .compact-spot-item ion-label p {
       color: #666 !important;
       font-size: 0.85rem;
       margin: 2px 0;
     }

     .available-spots-section {
       background: rgba(255, 255, 255, 0.95);
       border-radius: 16px;
       padding: 16px;
       margin: 16px 0;
       box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
     }

     ion-button {
       --border-radius: 8px;
       font-weight: 600;
     }

     ion-button[fill="solid"] {
       --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
     }

     ion-button[fill="outline"] {
       --border-width: 2px;
       --border-style: solid;
     }

     .drop-list {
       background: rgba(255, 255, 255, 0.1);
       border-radius: 12px;
       padding: 12px;
       min-height: 60px;
       border: 2px dashed rgba(255, 255, 255, 0.4);
       transition: all 0.3s ease;
     }

     .drop-list.cdk-drop-list-receiving {
       background: rgba(241, 196, 15, 0.2);
       border-color: #f1c40f;
       transform: scale(1.02);
       box-shadow: 0 0 20px rgba(241, 196, 15, 0.3);
     }

     .cdk-drag-preview {
       background: rgba(255, 255, 255, 0.95);
       box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
       border-radius: 12px;
       transform: rotate(3deg) scale(1.05);
       backdrop-filter: blur(10px);
     }

     .cdk-drag-placeholder {
       background: rgba(241, 196, 15, 0.2);
       border: 2px dashed #f1c40f;
       border-radius: 12px;
       opacity: 0.6;
     }

     .empty-message {
       background: rgba(255, 255, 255, 0.1);
       border-radius: 12px;
       padding: 24px;
       text-align: center;
       border: 2px dashed rgba(255, 255, 255, 0.3);
     }

     .empty-message ion-icon {
       font-size: 2.5rem;
       color: #f1c40f;
       margin-bottom: 12px;
     }

     .empty-message {
       background: rgba(255, 255, 255, 0.15);
       border: 2px dashed rgba(255, 255, 255, 0.4);
     }

     .empty-message p {
       color: rgba(255, 255, 255, 0.8);
       font-size: 0.9rem;
       margin: 0;
       font-weight: 500;
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
  startDate: string = '';
  numberOfDays: number = 1;
  dayLists: CdkDropList[] = [];
  allLists: (string | CdkDropList<any>)[] = [];
  searchQuery: string = '';
  originalAvailableSpots: any[] = [];

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

    // Initialize date settings
    this.initializeDateSettings();

    // Store original available spots for reference
    this.originalAvailableSpots = [...this.availableSpots];

    // Calculate available spots (spots not assigned to any day)
    this.calculateAvailableSpots();

    // Delay time slot updates to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.updateAllTimeSlots();
    }, 0);
  }

  private calculateAvailableSpots() {
    // Get all assigned spot names from the current edited itinerary
    const assignedSpotNames = new Set<string>();
    this.editedItinerary.forEach(day => {
      if (day && day.spots) {
        day.spots.forEach(spot => {
          assignedSpotNames.add(spot.name);
        });
      }
    });

    // Filter available spots to show only unassigned spots
    // Use original available spots as the source (same as user dashboard)
    this.availableSpots = this.originalAvailableSpots.filter(spot => !assignedSpotNames.has(spot.name));
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
    
    // Recalculate available spots after drag operation
    this.calculateAvailableSpots();
    
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
    // Recalculate available spots after removing
    this.calculateAvailableSpots();
    setTimeout(() => {
      this.updateTimeSlots(dayIndex);
    }, 0);
  }

  removeAllSpotsFromDay(dayIndex: number) {
    const day = this.editedItinerary[dayIndex];
    if (day && day.spots) {
      this.availableSpots.push(...day.spots);
      day.spots = [];
      // Recalculate available spots after removing
      this.calculateAvailableSpots();
      setTimeout(() => {
        this.updateTimeSlots(dayIndex);
      }, 0);
    }
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

    // Update all dates before saving to ensure date changes are applied
    this.updateAllDates();

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
    return this.availableSpots.filter(spot =>
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

  // Date editing methods
  private initializeDateSettings() {
    // Set start date from first day if available, otherwise use today
    if (this.editedItinerary.length > 0 && this.editedItinerary[0].date) {
      this.startDate = this.editedItinerary[0].date;
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const date = String(today.getDate()).padStart(2, '0');
      this.startDate = `${year}-${month}-${date}`;
    }

    // Set number of days
    this.numberOfDays = this.editedItinerary.length;
  }

  updateAllDates() {
    if (!this.startDate) {
      return;
    }

    const startDate = new Date(this.startDate);
    
    this.editedItinerary.forEach((day, dayIndex) => {
      if (day) {
        // Calculate the date for this day (startDate + dayIndex)
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + dayIndex);
        
        // Format as YYYY-MM-DD
        const year = dayDate.getFullYear();
        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
        const date = String(dayDate.getDate()).padStart(2, '0');
        const newDate = `${year}-${month}-${date}`;
        day.date = newDate;
      }
    });
    
    this.cdr.detectChanges();
  }

  updateNumberOfDays() {
    const currentDays = this.editedItinerary.length;
    const newDays = this.numberOfDays;

    if (newDays > currentDays) {
      // Add more days
      for (let i = currentDays; i < newDays; i++) {
        this.editedItinerary.push({
          day: i + 1,
          spots: [],
          date: '',
          routes: []
        });
      }
    } else if (newDays < currentDays) {
      // Remove days (move spots to available spots)
      for (let i = currentDays - 1; i >= newDays; i--) {
        const day = this.editedItinerary[i];
        if (day && day.spots) {
          this.availableSpots.push(...day.spots);
        }
      }
      this.editedItinerary.splice(newDays);
    }

    // Recalculate available spots after changing number of days
    this.calculateAvailableSpots();

    // Update dates after changing number of days
    this.updateAllDates();
    this.cdr.detectChanges();
  }

  formatDateDisplay(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
