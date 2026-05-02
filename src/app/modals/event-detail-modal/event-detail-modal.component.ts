import { Component, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { GlobalEvent } from '../../services/calendar.service';

@Component({
  selector: 'app-event-detail-modal',
  templateUrl: './event-detail-modal.component.html',
  styleUrls: ['./event-detail-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class EventDetailModalComponent {
  @Input() event!: GlobalEvent;

  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getEventDate(): string {
    const date = new Date(this.event.date);
    return date.toLocaleDateString();
  }

  getEventTimeRange(): string {
    if (this.event?.endTime) {
      return `${this.event.time} – ${this.event.endTime}`;
    }
    return this.event.time;
  }
}
