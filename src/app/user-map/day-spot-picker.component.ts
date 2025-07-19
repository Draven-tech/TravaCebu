import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ItineraryDay } from '../services/itinerary.service';

@Component({
  selector: 'app-day-spot-picker',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Choose Day & Spot</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
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
          <ion-label>Spots for Day {{ itinerary[selectedDay!].day }}</ion-label>
        </ion-list-header>
        <ion-item *ngFor="let spot of itinerary[selectedDay!].spots; let spotIndex = index" 
                  button (click)="selectSpot(selectedDay!, spotIndex)">
          <ion-label>
            <h3>{{ spot.name }}</h3>
            <p>{{ spot.timeSlot }} - {{ spot.estimatedDuration }}</p>
          </ion-label>
          <ion-icon name="chevron-forward" slot="end"></ion-icon>
        </ion-item>
      </div>
    </ion-content>
  `,
  styles: [`
    .spot-selection {
      margin-top: 20px;
    }
  `],
  standalone: false
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

  cancel() {
    this.modalCtrl.dismiss();
  }
} 