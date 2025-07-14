import { Component, Input, OnInit } from '@angular/core'; // Added Input import
import { ModalController, NavController } from '@ionic/angular';
import * as L from 'leaflet';

@Component({
  standalone: false,
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
})
export class TouristSpotDetailPage implements OnInit {
  @Input() spot: any;
  private map?: L.Map;
  private marker?: L.Marker;

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    setTimeout(() => this.initMap(), 100); // Small delay to ensure DOM is ready
  }

  private initMap() {
    if (!this.spot?.location) return;

    this.map = L.map('spot-detail-map', {
      center: [this.spot.location.lat, this.spot.location.lng],
      zoom: 15,
      preferCanvas: true
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19
    }).addTo(this.map);

    this.marker = L.marker([this.spot.location.lat, this.spot.location.lng], {
      icon: L.icon({
        iconUrl: 'assets/leaflet/marker-icon.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [12, 41],
        popupAnchor: [1, -34]
      })
    }).addTo(this.map);

    this.marker.bindPopup(`
      <div style="text-align: center;">
        <strong>${this.spot.name}</strong><br>
        ${this.spot.location.lat.toFixed(5)}, ${this.spot.location.lng.toFixed(5)}
      </div>
    `).openPopup();
  }

  close() {
    this.modalCtrl.dismiss();
  }

  editSpot() {
    this.close();
    this.navCtrl.navigateForward(['/admin/tourist-spot-editor'], {
      state: { spot: this.spot }
    });
  }
}