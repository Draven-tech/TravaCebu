import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ItineraryDay } from '../../services/itinerary.service';


@Component({
  selector: 'app-place-assignment-picker',
  templateUrl: './place-assignment-picker.component.html',
  styleUrls: ['./place-assignment-picker.component.scss'],
  standalone: false,
  
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

