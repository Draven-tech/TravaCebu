import { Component, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { NavController, ToastController, ModalController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BucketService } from '../services/bucket-list.service';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from './tourist-spot-sheet.component';
import { DirectionsService } from '../services/directions.service';
import { ApiTrackerService } from '../services/api-tracker.service';

@Component({
  selector: 'app-user-map',
  templateUrl: './user-map.page.html',
  styleUrls: ['./user-map.page.scss'],
  standalone: false,
})
export class UserMapPage implements AfterViewInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  searchQuery: string = '';
  touristSpots: any[] = [];
  public bucketService: BucketService;
  private routeLine?: L.Polyline;

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    bucketService: BucketService,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private modalCtrl: ModalController,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService
  ) {
    this.bucketService = bucketService;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 500);
    }, 200);
  }

  // Add Ionic lifecycle hook to ensure map resizes when page is entered
  ionViewDidEnter() {
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 300);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    if (this.map) {
      this.map.remove();
    }
    this.map = L.map('map', {
      center: [10.3157, 123.8854],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);
    this.loadTouristSpots();
    setTimeout(() => {
      this.map.invalidateSize();
    }, 300);
  }

  private async loadTouristSpots(): Promise<void> {
    try {
      this.firestore.collection('tourist_spots').valueChanges({ idField: 'id' }).subscribe(spots => {
        this.touristSpots = spots;
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
        this.showTouristSpots();
      });
    } catch (error) {
      console.error('Error loading tourist spots:', error);
    }
  }

  private showTouristSpots(): void {
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    const filtered = this.touristSpots.filter(spot =>
      !this.searchQuery || spot.name?.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    filtered.forEach((spot: any) => {
      if (!spot.location) return;
      const marker = L.marker([spot.location.lat, spot.location.lng], {
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
      marker.on('click', () => {
        this.ngZone.run(() => {
          this.openSpotSheet(spot);
        });
      });
      this.markers.push(marker);
    });
    if (filtered.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }

  async openSpotSheet(spot: any) {
    const modal = await this.modalCtrl.create({
      component: TouristSpotSheetComponent,
      componentProps: { spot },
      backdropDismiss: true
    });
    modal.onDidDismiss().then(result => {
      if (result.data && result.data.addToBucket) {
        this.bucketService.addToBucket(result.data.spot);
        this.toastCtrl.create({
          message: 'Added to bucket list!',
          duration: 2000,
          color: 'success',
          position: 'top',
        }).then(toast => toast.present());
      }
    });
    await modal.present();
  }

  async goToHome() {
    const user = await this.afAuth.currentUser;
    if (user) {
      this.navCtrl.navigateForward(`/user-dashboard/${user.uid}`);
    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  // Fetch and display a transit route from current location to a tourist spot
  async showRouteToSpot(spot: any) {
    // Example: Use a fixed origin for demo, replace with user's location if available
    const origin = 'Cebu City, Cebu';
    const destination = `${spot.location.lat},${spot.location.lng}`;
    // Check limiter
    const canCall = await this.apiTracker.canCallApiToday('directions', 100);
    if (!canCall) {
      this.toastCtrl.create({
        message: 'You have reached your daily limit for route requests. Please try again tomorrow.',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
      return;
    }
    // Log the API call
    this.apiTracker.logApiCall('directions', 'route', { origin, destination });
    // Fetch route
    this.directionsService.getTransitRoute(origin, destination).subscribe((result: any) => {
      if (result.status === 'OK' && result.routes.length > 0) {
        const polyline = result.routes[0].overview_polyline.points;
        const latlngs = this.decodePolyline(polyline);
        // Remove existing route if any
        if (this.routeLine) this.map.removeLayer(this.routeLine);
        this.routeLine = L.polyline(latlngs, { color: 'blue', weight: 5 }).addTo(this.map);
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
      } else {
        this.toastCtrl.create({
          message: 'No route found.',
          duration: 2000,
          color: 'warning'
        }).then(toast => toast.present());
      }
    }, error => {
      this.toastCtrl.create({
        message: 'Error fetching route.',
        duration: 2000,
        color: 'danger'
      }).then(toast => toast.present());
    });
  }

  // Polyline decoder (Google encoded polyline algorithm)
  decodePolyline(encoded: string): L.LatLng[] {
    let points: L.LatLng[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push(L.latLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }
}
