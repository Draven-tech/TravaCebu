import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList } from '@angular/cdk/drag-drop';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../../services/itinerary.service';

@Component({
  selector: 'app-itinerary-editor',
  templateUrl: './itinerary-editor.component.html',
  styleUrls: ['./itinerary-editor.component.scss'],
  standalone: false,
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
 this.editedItinerary.forEach((day: ItineraryDay) => {
  if (day && day.spots) {
    day.spots.forEach((spot: ItinerarySpot) => {
      assignedSpotNames.add(spot.name);
    });
  }
});

this.availableSpots = this.originalAvailableSpots.filter(
  (spot: ItinerarySpot) => !assignedSpotNames.has(spot.name)
);

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
  const spot: ItinerarySpot = this.editedItinerary[dayIndex].spots[spotIndex];
  this.availableSpots.push(spot);
  this.editedItinerary[dayIndex].spots.splice(spotIndex, 1);
  this.calculateAvailableSpots();
  setTimeout(() => this.updateTimeSlots(dayIndex), 0);
}

  removeAllSpotsFromDay(dayIndex: number) {
    const day: ItineraryDay = this.editedItinerary[dayIndex];
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

 day.spots.forEach((spot: ItinerarySpot) => {
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
    
    this.editedItinerary.forEach((day: ItineraryDay) => {
  if (day && day.spots) {
    day.spots.forEach((spot: ItinerarySpot) => {
      if (!spot.durationMinutes) {
        spot.durationMinutes = 120; // Default 2 hours
      }
    });
  }
});
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
    const day: ItineraryDay = this.editedItinerary[dayIndex];
    if (!day || !day.spots) return;

    // Start from the edited spot's time
    let currentTime = this.parseTime(day.spots[startSpotIndex].timeSlot || this.settings.startTime);

    // Update times for all spots from the edited spot onwards
for (let i = startSpotIndex; i < day.spots.length; i++) {
  const spot: ItinerarySpot = day.spots[i];
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

