import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  selectedTile: string = 'esri';
  private tileLayer?: L.TileLayer;
  
  // Edit mode tracking
  private isEditMode: boolean = false;
  private editingRouteId: string = '';

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

  osrmStatus: 'checking' | 'online' | 'offline' = 'checking';
  snappingService: 'osrm' | 'ors' = 'osrm';

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private activatedRoute: ActivatedRoute,
    private http: HttpClient
  ) {}

  private destroyMap() {
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
    this.markers = [];
    this.routeLine = undefined;
    this.tileLayer = undefined;
  }

  ngOnInit() {
    this.checkOsrmStatus();
    // Check for edit mode
    const nav = window.history.state;
    setTimeout(() => {
      this.destroyMap();
      if (nav && nav.routeToEdit) {
        const route = nav.routeToEdit;
        this.isEditMode = true;
        this.editingRouteId = route.id;
        this.routeCode = route.code || '';
        this.routeColor = route.color || '#FF5722';
        this.snapToRoads = route.snapToRoads !== undefined ? route.snapToRoads : true;
        this.initMap();
        if (route.points && Array.isArray(route.points)) {
          route.points.forEach((pt: any) => {
            this.addPin(L.latLng(pt.lat, pt.lng));
          });
          this.updateRouteLine();
        }
      } else {
        this.isEditMode = false;
        this.editingRouteId = '';
        this.initMap();
      }
    }, 0);
  }

  checkOsrmStatus() {
    const testUrl = 'https://router.project-osrm.org/route/v1/driving/123.885,10.315;123.891,10.314?overview=false';
    this.http.get(testUrl).toPromise()
      .then(() => this.osrmStatus = 'online')
      .catch(() => this.osrmStatus = 'offline');
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  private initMap() {
    this.map = L.map('route-editor-map', {
      center: [this.defaultLat, this.defaultLng],
      zoom: this.defaultZoom,
      preferCanvas: true
    });
    this.addTileLayer();
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addPin(e.latlng);
      this.updateRouteLine();
    });
  }

  private addTileLayer() {
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }
    if (this.selectedTile === 'esri') {
      this.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Satellite Imagery © Esri',
        maxZoom: 19
      });
    } else {
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      });
    }
    this.tileLayer.addTo(this.map);
  }

  onTileChange() {
    this.addTileLayer();
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
    if (this.snappingService === 'osrm') {
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
        console.error('OSRM routing error:', error);
        return points; // Fallback to straight line
      }
    } else if (this.snappingService === 'ors') {
      const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
      const coords = points.map(p => [p.lng, p.lat]);
      const body = { coordinates: coords };
      const headers = {
        'Authorization': environment.openRouteServiceApiKey,
        'Content-Type': 'application/json'
      };
      try {
        const response: any = await this.http.post(url, body, { headers }).toPromise();
        return response.features[0].geometry.coordinates.map(
          (coord: [number, number]) => L.latLng(coord[1], coord[0])
        );
      } catch (error) {
        console.error('ORS routing error:', error);
        return points;
      }
    }
    return points;
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
        message: 'You need at least 2 points to create a jeepney route',
        buttons: ['OK']
      });
      return await alert.present();
    }

    try {
      const routeData: any = {
        code: this.routeCode.toUpperCase().trim(),
        color: this.routeColor,
        points: this.markers.map(marker => {
          const latlng = marker.getLatLng();
          return { lat: latlng.lat, lng: latlng.lng };
        }),
        snapToRoads: this.snapToRoads,
        updatedAt: new Date()
      };

      if (this.isEditMode && this.editingRouteId) {
        // Update existing route
        await this.firestore.collection('jeepney_routes').doc(this.editingRouteId).update(routeData);
        
        const alert = await this.alertCtrl.create({
          header: 'Success',
          message: `Jeepney Route ${this.routeCode} updated successfully!`,
          buttons: ['OK']
        });
        await alert.present();
      } else {
        // Create new route
        routeData.createdAt = new Date();
        await this.firestore.collection('jeepney_routes').add(routeData);
        
        const alert = await this.alertCtrl.create({
          header: 'Success',
          message: `Jeepney Route ${this.routeCode} saved!`,
          buttons: ['OK']
        });
        await alert.present();
      }

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
    this.isEditMode = false;
    this.editingRouteId = '';
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