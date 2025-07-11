import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

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
  
  // Cebu coordinates with slight adjustment for better initial view
  defaultLat = 10.3157;
  defaultLng = 123.8854;
  defaultZoom = 12;
  
  // Route properties
  routeCode: string = '';
  routeColor: string = '#FF5722'; // Bright orange for visibility

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
  activatedRoute: any;

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
    this.map = L.map('route-editor-map', {
      center: [this.defaultLat, this.defaultLng],
      zoom: this.defaultZoom,
      preferCanvas: true
    });

    // Esri Satellite Imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19,
      minZoom: 7
    }).addTo(this.map);

    // Click handler for adding markers
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
    
    // Show coordinates in popup
    marker.bindPopup(`
      <div style="text-align: center;">
        <strong>Marker Position</strong><br>
        ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}
      </div>
    `);
  }

  updateRouteLine() {
    if (this.routeLine) this.map.removeLayer(this.routeLine);

    if (this.markers.length >= 2) {
      const polylineOptions: L.PolylineOptions = {
        color: this.routeColor,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      };

      // Dashed line for intermediate points
      if (this.markers.length > 2) {
        polylineOptions.dashArray = '5, 5';
      }

      this.routeLine = L.polyline(
        this.markers.map(m => m.getLatLng()),
        polylineOptions
      ).addTo(this.map);
      
      // Auto-zoom to show route
      this.map.fitBounds(this.routeLine.getBounds(), {
        padding: [50, 50],
        maxZoom: 17
      });
    }
  }

  async saveRoute() {
    // Validate route code
    if (!this.routeCode || this.routeCode.trim().length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Route Code',
        message: 'Please enter a valid route code (e.g. 12C, 01A)',
        buttons: ['OK']
      });
      return await alert.present();
    }

    // Validate markers
    if (this.markers.length < 2) {
      const alert = await this.alertCtrl.create({
        header: 'Incomplete Route',
        message: 'You need at least 2 markers to create a route',
        buttons: ['OK']
      });
      return await alert.present();
    }

    try {
      await this.firestore.collection('jeepney_routes').add({
        code: this.routeCode.toUpperCase().trim(),
        color: this.routeColor,
        coordinates: this.markers.map(marker => {
          const latlng = marker.getLatLng();
          return { lat: latlng.lat, lng: latlng.lng };
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const alert = await this.alertCtrl.create({
        header: 'Success',
        message: `Route ${this.routeCode} saved successfully!`,
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
    // Clear markers
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
    
    // Clear route line
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = undefined;
    }
    
    // Reset form
    this.routeCode = '';
    
    // Reset view
    this.map.setView([this.defaultLat, this.defaultLng], this.defaultZoom);
  }

  removeLastPin() {
    if (this.markers.length > 0) {
      const lastMarker = this.markers.pop();
      if (lastMarker) this.map.removeLayer(lastMarker);
      this.updateRouteLine();
    }
  }

  ionViewWillEnter() {
    const routeToEdit = this.activatedRoute.snapshot?.root?.firstChild?.params?.state?.routeToEdit;
    if (routeToEdit) {
      this.loadRouteForEditing(routeToEdit);
    }
  }
  
  private loadRouteForEditing(route: any) {
    this.routeCode = route.code;
    this.routeColor = route.color || '#FF5722';
    
    // Clear any existing markers
    this.clearRoute();
    
    // Add markers for each coordinate
    route.coordinates.forEach((coord: any) => {
      this.addPin(L.latLng(coord.lat, coord.lng));
    });
    
    // Update the route line
    this.updateRouteLine();
    
    // Zoom to show the entire route
    if (this.markers.length > 0) {
      this.map.fitBounds(
        L.featureGroup(this.markers).getBounds(),
        { padding: [50, 50] }
      );
    }
  }
}