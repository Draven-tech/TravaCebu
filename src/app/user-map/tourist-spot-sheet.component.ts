import { Component, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-tourist-spot-sheet',
  templateUrl: './tourist-spot-sheet.component.html',
  styleUrls: ['./tourist-spot-sheet.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class TouristSpotSheetComponent {
  @Input() spot: any;

  constructor(private modalCtrl: ModalController) {}

  close() {
    this.modalCtrl.dismiss();
  }

  addToBucket() {
    this.modalCtrl.dismiss({ addToBucket: true, spot: this.spot });
  }
} 