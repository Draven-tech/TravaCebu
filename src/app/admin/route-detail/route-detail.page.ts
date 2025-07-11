import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { DatePipe } from '@angular/common';

@Component({
  standalone: false,
  selector: 'app-route-detail',
  templateUrl: './route-detail.page.html',
  styleUrls: ['./route-detail.page.scss'],
})
export class RouteDetailPage {
  @Input() route: any;

  constructor(
    private modalCtrl: ModalController,
    private datePipe: DatePipe
  ) {}

  close() {
    this.modalCtrl.dismiss();
  }

  formatDate(date: any) {
    return this.datePipe.transform(date, 'medium');
  }
}