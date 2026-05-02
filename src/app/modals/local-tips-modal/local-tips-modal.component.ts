import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-local-tips-modal',
  templateUrl: './local-tips-modal.component.html',
  styleUrls: ['./local-tips-modal.component.scss'],
  standalone: false
})
export class LocalTipsModalComponent implements OnInit {
  @Input() spotName = '';
  @Input() spotId = '';
  @Input() tips: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController
  ) {}

  ngOnInit(): void {}

  close(): void {
    void this.modalCtrl.dismiss();
  }

  openSpotDetail(): void {
    if (!this.spotId) {
      return;
    }
    void this.modalCtrl.dismiss();
    void this.navCtrl.navigateForward(`/tourist-spot-detail/${this.spotId}`);
  }
}
