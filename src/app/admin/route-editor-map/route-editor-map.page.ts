import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: false,
  selector: 'app-route-editor-map',
  templateUrl: './route-editor-map.page.html',
  styleUrls: ['./route-editor-map.page.scss'],
})
export class RouteEditorMapPage implements OnInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private routeLine?: L.Polyline;
  private routingServiceUrl = 'https://router.project-osrm.org/route/v1/driving/';
  
  // Cebu coordinates
  defaultLat = 10.3157;
  defaultLng = 123.8854;
  defaultZoom = 15;
  
  // Route properties
  routeCode: string = '';
  routeColor: string = '#FF5722';
  snapToRoads: boolean = true;
  isCalculatingRoute: boolean = false;

  // Custom marker icon
  private customIcon = L.icon({
    iconUrl: 'assets/leaflet/marker-icon.png',
    shadowUrl: 'assets/leaflet/marker-shadow.png',
    iconSize: [25, 41],
    shadowSize: [41, 41],
    iconAnchor: [12, 41],
    shadowAnchor: [12, 41],
    popupAnchor: [1, -34]
  });

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private activatedRoute: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  private initMap() {
    this.map = L.map('route-editor-map', {
      center: [this.defaultLat, this.defaultLng],
      zoom: this.defaultZoom,
      preferCanvas: true
    });

    // Esri Satellite with Labels
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19
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
      icon: this.customIcon,
      autoPan: true
    }).addTo(this.map);

    marker.on('dragend', () => this.updateRouteLine());
    this.markers.push(marker);
    
    marker.bindPopup(`
      <div style="text-align: center;">
        <strong>Jeepney Stop</strong><br>
        ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}
      </div>
    `);
  }

  private async getRoutePath(points: L.LatLng[]): Promise<L.LatLng[]> {
    const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${this.routingServiceUrl}${coordinates}?overview=full&geometries=geojson`;
    
    try {
      const response: any = await this.http.get(url).toPromise();
      if (response.code === 'Ok' && response.routes.length > 0) {
        return response.routes[0].geometry.coordinates.map((coord: [number, number]) => 
          L.latLng(coord[1], coord[0])
        );
      }
      return points; // Fallback to straight line
    } catch (error) {
      console.error('Routing error:', error);
      return points; // Fallback to straight line
    }
  }

  async updateRouteLine() {
    if (this.routeLine) this.map.removeLayer(this.routeLine);
    if (this.markers.length < 2) return;

    this.isCalculatingRoute = true;
    
    try {
      const points = this.markers.map(m => m.getLatLng());
      const routePath = this.snapToRoads 
        ? await this.getRoutePath(points) 
        : points;

      this.routeLine = L.polyline(routePath, {
        color: this.routeColor,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round',
        dashArray: this.snapToRoads ? undefined : '5, 5'
      }).addTo(this.map);

      this.map.fitBounds(this.routeLine.getBounds(), {
        padding: [50, 50]
      });
    } finally {
      this.isCalculatingRoute = false;
    }
  }

  async saveRoute() {
    if (!this.routeCode || this.routeCode.trim().length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Route Code',
        message: 'Please enter a valid jeepney route code (e.g. 12C, 01A)',
        buttons: ['OK']
      });
      return await alert.present();
    }

    if (this.markers.length < 2) {
      const alert = await this.alertCtrl.create({
        header: 'Incomplete Route',
        message: 'You need at least 2 stops to create a jeepney route',
        buttons: ['OK']
      });
      return await alert.present();
    }

    try {
      const routeData = {
        code: this.routeCode.toUpperCase().trim(),
        color: this.routeColor,
        stops: this.markers.map(marker => {
          const latlng = marker.getLatLng();
          return { lat: latlng.lat, lng: latlng.lng };
        }),
        snapToRoads: this.snapToRoads,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.firestore.collection('jeepney_routes').add(routeData);

      const alert = await this.alertCtrl.create({
        header: 'Success',
        message: `Jeepney Route ${this.routeCode} saved!`,
        buttons: ['OK']
      });
      await alert.present();

      this.clearRoute();
    } catch (error) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to save route. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  clearRoute() {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
    
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = undefined;
    }
    
    this.routeCode = '';
    this.map.setView([this.defaultLat, this.defaultLng], this.defaultZoom);
  }

  removeLastPin() {
    if (this.markers.length > 0) {
      const lastMarker = this.markers.pop();
      if (lastMarker) this.map.removeLayer(lastMarker);
      this.updateRouteLine();
    }
  }

  toggleSnapToRoads() {
    this.updateRouteLine();
  }
}