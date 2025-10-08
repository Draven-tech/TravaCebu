import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-restaurant-card',
  templateUrl: './restaurant-card.component.html',
  styleUrls: ['./restaurant-card.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class RestaurantCardComponent {
  @Input() restaurant: any;
  @Input() timeslot: string = '';
  @Output() timeslotChange = new EventEmitter<string>();

  onTimeslotChange(event: any) {
    this.timeslotChange.emit(event.detail.value);
  }
}
