import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ItineraryDay } from '../services/itinerary.service';

@Component({
  selector: 'app-place-assignment-picker',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>{{ placeType === 'restaurant' ? 'Assign Restaurant' : 'Assign Hotel' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="assignment-container">
        <div class="place-info">
          <h3>{{ placeName }}</h3>
          <p>{{ placeType === 'restaurant' ? 'Choose which meal time to assign this restaurant to:' : 'Choose which day to assign this hotel to:' }}</p>
        </div>

        <!-- Restaurant Assignment Options -->
        <div *ngIf="placeType === 'restaurant'" class="assignment-options">
          <div *ngFor="let day of itinerary; let dayIndex = index" class="day-section">
            <h4>Day {{ day.day }}</h4>
            <div *ngFor="let spot of day.spots; let spotIndex = index" class="option-item">
              <div *ngIf="spot.mealType && !spot.chosenRestaurant" 
                   class="meal-option" 
                   (click)="assignRestaurant(dayIndex, spotIndex)">
                <div class="option-header">
                  <ion-icon name="restaurant-outline" color="warning"></ion-icon>
                  <span class="spot-name">{{ spot.name }}</span>
                </div>
                <div class="meal-info">
                  <span class="meal-type">{{ spot.mealType }} time</span>
                  <span class="time-slot">{{ spot.timeSlot }}</span>
                </div>
                <ion-icon name="chevron-forward" color="medium"></ion-icon>
              </div>
              
              <div *ngIf="spot.mealType && spot.chosenRestaurant" class="meal-option disabled">
                <div class="option-header">
                  <ion-icon name="restaurant" color="medium"></ion-icon>
                  <span class="spot-name">{{ spot.name }}</span>
                </div>
                <div class="meal-info">
                  <span class="meal-type">{{ spot.mealType }} time</span>
                  <span class="assigned-restaurant">{{ spot.chosenRestaurant.name }}</span>
                </div>
                <ion-icon name="checkmark-circle" color="success"></ion-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- Hotel Assignment Options -->
        <div *ngIf="placeType === 'hotel'" class="assignment-options">
          <div *ngFor="let day of itinerary; let dayIndex = index" class="day-section">
            <div class="option-item">
              <div *ngIf="!day.chosenHotel" 
                   class="hotel-option" 
                   (click)="assignHotel(dayIndex)">
                <div class="option-header">
                  <ion-icon name="bed-outline" color="primary"></ion-icon>
                  <span class="day-name">Day {{ day.day }} - End of Day</span>
                </div>
                <div class="hotel-info">
                  <span class="spots-count">{{ day.spots.length }} tourist spots</span>
                </div>
                <ion-icon name="chevron-forward" color="medium"></ion-icon>
              </div>
              
              <div *ngIf="day.chosenHotel" class="hotel-option disabled">
                <div class="option-header">
                  <ion-icon name="bed" color="medium"></ion-icon>
                  <span class="day-name">Day {{ day.day }} - End of Day</span>
                </div>
                <div class="hotel-info">
                  <span class="assigned-hotel">{{ day.chosenHotel.name }}</span>
                </div>
                <ion-icon name="checkmark-circle" color="success"></ion-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- No Available Options -->
        <div *ngIf="!hasAvailableOptions()" class="no-options">
          <ion-icon name="information-circle-outline" color="medium"></ion-icon>
          <h4>No Available {{ placeType === 'restaurant' ? 'Meal Times' : 'Days' }}</h4>
          <p>
            {{ placeType === 'restaurant' 
               ? 'All meal times in your itinerary already have restaurants assigned.' 
               : 'All days in your itinerary already have hotels assigned.' }}
          </p>
          <ion-button fill="outline" color="secondary" (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
            Go Back
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .assignment-container {
      padding: 16px;
    }

    .place-info {
      text-align: center;
      margin-bottom: 24px;
    }

    .place-info h3 {
      color: #ffffff;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .place-info p {
      color: #cccccc;
      font-size: 0.9rem;
    }

    .day-section {
      margin-bottom: 24px;
    }

    .day-section h4 {
      color: #e74c3c;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #dee2e6;
    }

    .option-item {
      margin-bottom: 8px;
    }

    .meal-option, .hotel-option {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      border: 2px solid #dee2e6;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .meal-option:not(.disabled):hover, .hotel-option:not(.disabled):hover {
      border-color: #FF9800;
      background: #fff8f0;
    }

    .meal-option.disabled, .hotel-option.disabled {
      opacity: 0.6;
      cursor: not-allowed;
      border-color: #e9ecef;
      background: #f8f9fa;
    }

    .option-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .spot-name, .day-name {
      font-weight: 600;
      color: #2D3748;
    }

    .meal-info, .hotel-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-right: auto;
    }

    .meal-type, .time-slot, .spots-count {
      font-size: 0.85rem;
      color: #666;
    }

    .meal-type {
      color: #FF9800;
      font-weight: 500;
      text-transform: capitalize;
    }

    .assigned-restaurant, .assigned-hotel {
      font-size: 0.85rem;
      color: #28a745;
      font-weight: 500;
    }

    .no-options {
      text-align: center;
      padding: 32px 16px;
      color: #666;
    }

    .no-options ion-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }

    .no-options h4 {
      margin-bottom: 8px;
      color: #2D3748;
    }

    .no-options p {
      margin-bottom: 24px;
      line-height: 1.5;
    }
  `],
  standalone: false
})
export class PlaceAssignmentPickerComponent {
  @Input() itinerary: ItineraryDay[] = [];
  @Input() placeName: string = '';
  @Input() placeType: 'restaurant' | 'hotel' = 'restaurant';

  constructor(private modalCtrl: ModalController) {}

  hasAvailableOptions(): boolean {
    if (this.placeType === 'restaurant') {
      return this.itinerary.some(day => 
        day.spots.some(spot => spot.mealType && !spot.chosenRestaurant)
      );
    } else {
      return this.itinerary.some(day => !day.chosenHotel);
    }
  }

  assignRestaurant(dayIndex: number, spotIndex: number) {
    this.modalCtrl.dismiss({
      type: 'restaurant',
      dayIndex,
      spotIndex
    });
  }

  assignHotel(dayIndex: number) {
    this.modalCtrl.dismiss({
      type: 'hotel',
      dayIndex
    });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
