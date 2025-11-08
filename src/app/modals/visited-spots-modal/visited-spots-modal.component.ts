import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-visited-spots-modal',
  templateUrl: './visited-spots-modal.component.html',
  styleUrls: ['./visited-spots-modal.component.scss'],
  standalone: false,
})
export class VisitedSpotsModalComponent {
  @Input() visitedSpots: any[] = [];

  constructor(private modalCtrl: ModalController) {}

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  getVisitedDate(visitedAt: any): Date | null {
    if (!visitedAt) {
      return null;
    }

    if (visitedAt.toDate && typeof visitedAt.toDate === 'function') {
      return visitedAt.toDate();
    }

    if (visitedAt instanceof Date) {
      return visitedAt;
    }

    const timestamp = new Date(visitedAt);
    return isNaN(timestamp.getTime()) ? null : timestamp;
  }
}




