import { Component, AfterViewInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';

import * as L from 'leaflet';

@Component({
  selector: 'app-user-map',
  templateUrl: './user-map.page.html',
  styleUrls: ['./user-map.page.scss'],
  standalone: false,
})
export class UserMapPage implements AfterViewInit {
  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth
  ) { }

    private map!: L.Map;
  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    this.map = L.map('map').setView([10.3157, 123.8854], 12); // Centered at Cebu

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);
  }
  async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);

    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }
}
