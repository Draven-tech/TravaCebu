import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-restaurant-card',
  template: `
    <div class="restaurant-card">
      <div class="card-header">
        <ion-icon name="restaurant" color="warning"></ion-icon>
        <span class="card-title">{{ restaurant.name }}</span>
      </div>
      <div class="card-content">
        <div class="place-details">
          <span *ngIf="restaurant.rating">⭐ {{ restaurant.rating }}★</span>
          <span *ngIf="restaurant.vicinity">📍 {{ restaurant.vicinity }}</span>
        </div>
        <div class="timeslot-edit">
          <ion-label>Timeslot:</ion-label>
          <ion-datetime
            display-format="HH:mm"
            picker-format="HH:mm"
            [value]="timeslot"
            (ionChange)="onTimeslotChange($event)">
          </ion-datetime>
        </div>
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .restaurant-card {
      background: #fff;
      border-radius: 8px;
      padding: 12px;
      border: 2px solid #ffc107;
      margin-bottom: 12px;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 8px;
    }
    .card-title {
      flex: 1;
    }
    .card-content {
      max-width: 100%;
    }
    .place-details {
      margin-bottom: 8px;
      font-size: 0.85rem;
      color: #6c757d;
    }
    .timeslot-edit {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
  `],
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