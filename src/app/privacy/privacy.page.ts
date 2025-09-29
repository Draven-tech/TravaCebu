import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  standalone: false,
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage {

  constructor(private navCtrl: NavController) {}

  goBack() {
    this.navCtrl.back();
  }
}
