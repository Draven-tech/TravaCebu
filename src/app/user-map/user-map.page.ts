import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import * as L from 'leaflet';

@Component({
  selector: 'app-user-map',
  templateUrl: './user-map.page.html',
  styleUrls: ['./user-map.page.scss'],
  standalone: false,
})
export class UserMapPage implements AfterViewInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private routeLines: L.Polyline[] = [];

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) { }

  ngAfterViewInit(): void {
    // Delay initialization to ensure DOM is ready
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Destroy existing map if it exists
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('map', {
      center: [10.3157, 123.8854], // Centered at Cebu
      zoom: 12,
      preferCanvas: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);

    // Load routes after map is ready
    this.loadRoutes();

    // Trigger resize after a short delay to ensure proper rendering
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  private async loadRoutes(): Promise<void> {
    try {
      const routesSnapshot = await this.firestore.collection('jeepney_routes').get().toPromise();
      
      routesSnapshot?.forEach((doc) => {
        const route = doc.data() as any;
        if (route.points && route.points.length >= 2) {
          this.addRouteToMap(route);
        }
      });
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  }

  private addRouteToMap(route: any): void {
    // Add markers for route points
    route.points.forEach((point: any) => {
      const marker = L.marker([point.lat, point.lng], {
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

      marker.bindPopup(`
        <div style="text-align: center;">
          <strong>Route ${route.code}</strong><br>
          Jeepney Stop
        </div>
      `);

      this.markers.push(marker);
    });

    // Add route line
    if (route.points.length >= 2) {
      const points = route.points.map((point: any) => [point.lat, point.lng]);
      const routeLine = L.polyline(points, {
        color: route.color || '#3366ff',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(this.map);

      this.routeLines.push(routeLine);
    }
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
