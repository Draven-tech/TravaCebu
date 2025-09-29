import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ItineraryDay } from '../services/itinerary.service';

@Component({
  selector: 'app-day-spot-picker',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Add to Itinerary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="picker-container">
        <h3>Choose Day & Position</h3>
        
        <ion-list>
          <ion-item *ngFor="let day of itinerary; let dayIndex = index">
            <ion-label>
              <h2>Day {{ day.day }}</h2>
              <p>{{ day.spots.length }} spots</p>
            </ion-label>
            <ion-button slot="end" fill="clear" (click)="selectDay(dayIndex)">
              Select Day
            </ion-button>
          </ion-item>
        </ion-list>
        
        <div *ngIf="selectedDay !== null" class="spot-selection">
          <ion-list-header>
            <ion-label>Choose position in Day {{ itinerary[selectedDay!].day }}</ion-label>
          </ion-list-header>
          
          <!-- Add at beginning option -->
          <ion-item button (click)="selectSpot(selectedDay!, 0)">
            <ion-label>
              <h3>Add at beginning</h3>
              <p>First spot of the day</p>
            </ion-label>
            <ion-icon name="add-circle-outline" slot="end" color="primary"></ion-icon>
          </ion-item>
          
          <!-- Add between existing spots -->
          <ion-item *ngFor="let spot of itinerary[selectedDay!].spots; let spotIndex = index" 
                    button (click)="selectSpot(selectedDay!, spotIndex + 1)">
            <ion-label>
              <h3>After: {{ spot.name }}</h3>
              <p>{{ spot.timeSlot }} - {{ spot.estimatedDuration }}</p>
            </ion-label>
            <ion-icon name="chevron-forward" slot="end"></ion-icon>
          </ion-item>
          
          <!-- Add at end option -->
          <ion-item button (click)="selectSpot(selectedDay!, itinerary[selectedDay!].spots.length)">
            <ion-label>
              <h3>Add at end</h3>
              <p>Last spot of the day</p>
            </ion-label>
            <ion-icon name="add-circle-outline" slot="end" color="primary"></ion-icon>
          </ion-item>
        </div>
        
        <!-- Create new day option -->
        <div class="new-day-option">
          <ion-button expand="block" fill="outline" color="secondary" (click)="createNewDay()">
            <ion-icon name="add-circle-outline" slot="start"></ion-icon>
            Create New Day
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .picker-container {
      padding: 16px;
    }
    
    .picker-container h3 {
      margin-bottom: 16px;
      color: #333;
      font-weight: 600;
    }
    
    .spot-selection {
      margin-top: 20px;
    }
    
    .new-day-option {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    
    ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
      --min-height: 60px;
    }
    
    ion-item h3 {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    
    ion-item p {
      color: #666;
      font-size: 0.9rem;
      margin: 0;
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class DaySpotPickerComponent {
  @Input() itinerary: ItineraryDay[] = [];
  @Output() daySpotSelected = new EventEmitter<{dayIndex: number, spotIndex: number}>();
  
  selectedDay: number | null = null;

  constructor(private modalCtrl: ModalController) {}

  selectDay(dayIndex: number) {
    this.selectedDay = dayIndex;
  }

  selectSpot(dayIndex: number, spotIndex: number) {
    this.daySpotSelected.emit({ dayIndex, spotIndex });
    this.modalCtrl.dismiss({ dayIndex, spotIndex });
  }

  createNewDay() {
    const newDayIndex = this.itinerary.length;
    const newDay = {
      day: newDayIndex + 1,
      spots: [],
      routes: [],
      hotelSuggestions: [],
      chosenHotel: null
    };
    this.itinerary.push(newDay);
    this.selectSpot(newDayIndex, 0);
  }

  cancel() {
    this.modalCtrl.dismiss();
  }
}
