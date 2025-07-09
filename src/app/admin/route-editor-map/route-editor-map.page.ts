import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';

@Component({
  standalone: false,
  selector: 'app-route-editor-map',
  templateUrl: './route-editor-map.page.html',
  styleUrls: ['./route-editor-map.page.scss'],
})
export class RouteEditorMapPage implements OnInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private routePolyline?: L.Polyline;
  
  // Route metadata
  routeName: string = '';
  routeCode: string = '';
  routeColor: string = '#3366ff';

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  private initMap() {
    this.map = L.map('route-editor-map').setView([10.3157, 123.8854], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // Click handler for adding pins
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addPin(e.latlng);
      this.updateRouteLine();
    });
  }

  private addPin(latlng: L.LatLng) {
    const marker = L.marker(latlng, {
      draggable: true,
      icon: L.icon({
        iconUrl: 'assets/pin-icon.png',
        iconSize: [32, 32]
      })
    }).addTo(this.map);

    marker.on('dragend', () => this.updateRouteLine());
    this.markers.push(marker);
  }

  updateRouteLine() {
    // Remove existing polyline if any
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }

    // Create new polyline connecting all markers
    if (this.markers.length >= 2) {
      const latlngs = this.markers.map(m => m.getLatLng());
      this.routePolyline = L.polyline(latlngs, {
        color: this.routeColor,
        weight: 5
      }).addTo(this.map);
    }
  }

  async saveRoute() {
    if (this.markers.length < 2) {
      const alert = await this.alertCtrl.create({
        header: 'Incomplete Route',
        message: 'You need at least 2 pins to create a route',
        buttons: ['OK']
      });
      return await alert.present();
    }

    const coordinates = this.markers.map(marker => {
      const latlng = marker.getLatLng();
      return [latlng.lat, latlng.lng];
    });

    try {
      await this.firestore.collection('jeepney_routes').add({
        code: this.routeCode,
        name: this.routeName,
        color: this.routeColor,
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        },
        createdAt: new Date()
      });

      const successAlert = await this.alertCtrl.create({
        header: 'Success',
        message: 'Route saved successfully!',
        buttons: ['OK']
      });
      await successAlert.present();

      // Reset editor
      this.clearRoute();
    } catch (error) {
      console.error('Error saving route:', error);
      const errorAlert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to save route',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  clearRoute() {
    // Remove all markers
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
    
    // Remove polyline
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = undefined;
    }
    
    // Reset form
    this.routeName = '';
    this.routeCode = '';
  }

  removeLastPin() {
    if (this.markers.length > 0) {
      const lastMarker = this.markers.pop();
      if (lastMarker) this.map.removeLayer(lastMarker);
      this.updateRouteLine();
    }
  }
}