import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ItineraryDay } from '../../services/itinerary.service';


@Component({
  selector: 'app-day-spot-picker',
  templateUrl: './day-spot-picker.component.html',
  styleUrls: ['./day-spot-picker.component.scss'],
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

