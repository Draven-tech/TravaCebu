import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import * as L from 'leaflet';

@Component({
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
  standalone: false,
})
export class TouristSpotDetailPage implements OnInit {
  public spotData: any;
  private map?: L.Map;
  private marker?: L.Marker;

  constructor(private route: ActivatedRoute, private navCtrl: NavController) {}

  ngOnInit() {
    // Try to get spot data from navigation state (modal or route)
    if (window.history.state && window.history.state.spot) {
      this.spotData = window.history.state.spot;
    } else {
      // Fallback: get from route params or service if needed
      // this.spotData = ...
    }
    setTimeout(() => this.initMap(), 100); // Small delay to ensure DOM is ready
  }

  private initMap() {
    if (!this.spotData?.location) return;

    this.map = L.map('spot-detail-map', {
      center: [this.spotData.location.lat, this.spotData.location.lng],
      zoom: 15,
      preferCanvas: true
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19
    }).addTo(this.map);

    this.marker = L.marker([this.spotData.location.lat, this.spotData.location.lng], {
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
        <strong>${this.spotData.name}</strong><br>
        ${this.spotData.location.lat.toFixed(5)}, ${this.spotData.location.lng.toFixed(5)}
      </div>
    `).openPopup();
  }

  close() {
    // The original code had modalCtrl, but it's not imported.
    // Assuming this function is no longer relevant or needs to be re-evaluated
    // based on the new structure, but for now, keeping it as is.
    // If modalCtrl is intended to be used, it needs to be re-added.
    // For now, commenting out the line as it's not defined.
    // this.modalCtrl.dismiss();
  }

  editSpot() {
    this.close();
    this.navCtrl.navigateForward(['/admin/tourist-spot-editor'], {
      state: { spot: this.spotData }
    });
  }
}