import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import * as L from 'leaflet';
import { DatePipe } from '@angular/common';

@Component({
  standalone: false,
  selector: 'app-route-detail',
  templateUrl: './route-detail.page.html',
  styleUrls: ['./route-detail.page.scss'],
})
export class RouteDetailPage implements OnInit {
  @Input() route: any;
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private routeLine?: L.Polyline;

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    setTimeout(() => this.initMap(), 100); // Small delay to ensure DOM is ready
  }

  private initMap() {
    if (!this.route?.stops || this.route.stops.length === 0) return;

    // Calculate center point
    const center = this.calculateCenter(this.route.stops);
    
    this.map = L.map('route-detail-map', {
      center: [center.lat, center.lng],
      zoom: 13,
      preferCanvas: true
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19
    }).addTo(this.map);

    // Add markers
    this.route.stops.forEach((stop: any) => {
      const marker = L.marker([stop.lat, stop.lng], {
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
      this.markers.push(marker);
    });

    // Add route line
    const points = this.route.stops.map((stop: any) => [stop.lat, stop.lng]);
    this.routeLine = L.polyline(points, {
      color: this.route.color || '#3366ff',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round'
    }).addTo(this.map);

    // Fit bounds to show entire route
    this.map.fitBounds(this.routeLine.getBounds(), {
      padding: [50, 50]
    });
  }

  private calculateCenter(stops: any[]) {
    if (stops.length === 0) return { lat: 0, lng: 0 };
    
    let latSum = 0;
    let lngSum = 0;
    
    stops.forEach(stop => {
      latSum += stop.lat;
      lngSum += stop.lng;
    });
    
    return {
      lat: latSum / stops.length,
      lng: lngSum / stops.length
    };
  }

  close() {
    this.modalCtrl.dismiss();
  }

  editRoute() {
    this.close();
    this.navCtrl.navigateForward(['/admin/route-editor'], {
      state: { routeToEdit: this.route }
    });
  }
}