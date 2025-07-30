import { Component, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { NavController, ToastController, ModalController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BucketService } from '../services/bucket-list.service';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from './tourist-spot-sheet.component';
import { DirectionsService } from '../services/directions.service';
import { ApiTrackerService } from '../services/api-tracker.service';
import { Geolocation } from '@capacitor/geolocation';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { DaySpotPickerComponent } from './day-spot-picker.component';

@Component({
  selector: 'app-user-map',
  templateUrl: './user-map.page.html',
  styleUrls: ['./user-map.page.scss'],
  standalone: false,
})
export class UserMapPage implements AfterViewInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private userMarker?: L.Marker;
  private stopMarker?: L.Marker;
  private walkLine?: L.Polyline;
  private jeepneyLine?: L.Polyline;
  searchQuery: string = '';
  touristSpots: any[] = [];
  public bucketService: BucketService;
  private routeLine?: L.Polyline;
  itinerary: ItineraryDay[] = [];
  navigationInstructions: string[] = [];
  navigating: boolean = false;

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    bucketService: BucketService,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private modalCtrl: ModalController,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private itineraryService: ItineraryService
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
    this.loadItinerary();
  }

  async loadItinerary() {
    // Load itinerary from bucket service or localStorage (as in bucket-list.page.ts)
    const cached = localStorage.getItem('itinerary_suggestions_cache');
    if (cached) {
      try {
        this.itinerary = JSON.parse(cached);
      } catch {}
    }
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
    modal.onDidDismiss().then(async result => {
      if (result.data && result.data.addToBucket) {
        try {
          await this.bucketService.addToBucket(result.data.spot);
          this.toastCtrl.create({
            message: `${result.data.spot.name} added to bucket list!`,
            duration: 2000,
            color: 'success',
            position: 'top',
            buttons: [
              {
                icon: 'checkmark-circle',
                side: 'start'
              }
            ]
          }).then(toast => toast.present());
        } catch (error) {
          console.error('Error adding to bucket list:', error);
          this.toastCtrl.create({
            message: 'Failed to add to bucket list. Please try again.',
            duration: 2000,
            color: 'danger',
            position: 'top'
          }).then(toast => toast.present());
        }
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

  async showUserLocation() {
    const position = await Geolocation.getCurrentPosition();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/leaflet/marker-icon.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: 'user-location-marker'
      })
    }).addTo(this.map);
    this.map.setView([lat, lng], 15);
    return { lat, lng };
  }

  async navigateNextItineraryStep() {
    this.navigating = true;
    this.navigationInstructions = [];
    
    // Check if itinerary exists
    if (!this.itinerary || this.itinerary.length === 0) {
      this.navigationInstructions = ['No itinerary found. Please create an itinerary first.'];
      this.navigating = false;
      return;
    }

    // Show day/spot picker modal
    const modal = await this.modalCtrl.create({
      component: DaySpotPickerComponent,
      componentProps: {
        itinerary: this.itinerary
      },
      breakpoints: [0, 0.5, 0.8],
      initialBreakpoint: 0.5
    });

    await modal.present();
    
    const result = await modal.onWillDismiss();
    if (result.data) {
      const { dayIndex, spotIndex } = result.data;
      await this.navigateToDaySpot(dayIndex, spotIndex);
    } else {
      this.navigating = false;
    }
  }

  async navigateToDaySpot(dayIndex: number, spotIndex: number = 0) {
    if (!this.itinerary || dayIndex >= this.itinerary.length) {
      this.navigationInstructions = ['Invalid day selection.'];
      this.navigating = false;
      return;
    }

    const day = this.itinerary[dayIndex];
    if (!day.spots || spotIndex >= day.spots.length) {
      this.navigationInstructions = ['No spots available for this day.'];
      this.navigating = false;
      return;
    }

    const targetSpot = day.spots[spotIndex];
    
    // 1. Get user location
    const userLoc = await this.showUserLocation();
    
    // 2. Find all curated jeepney routes that end at this spot
    const routesSnap = await this.firestore.collection('jeepney_routes', ref =>
      ref.where('points', 'array-contains', { lat: targetSpot.location.lat, lng: targetSpot.location.lng })
    ).get().toPromise();

    // Fix TypeScript errors with proper null checking
    if (!routesSnap || routesSnap.empty) {
      this.navigationInstructions = ['No curated jeepney route found to this spot.'];
      this.navigating = false;
      return;
    }

    let bestRoute: any = null;
    let bestStart: any = null;
    let minDist = Infinity;

    // 3. For each route, find the start point closest to user
    for (const doc of routesSnap.docs) {
      const route = doc.data() as any; // Type assertion to fix 'unknown' type
      if (!route.points || route.points.length < 2) continue;
      const start = route.points[0];
      const dist = this.getDistance(userLoc, start);
      if (dist < minDist) {
        minDist = dist;
        bestRoute = route;
        bestStart = start;
      }
    }

    if (!bestRoute) {
      this.navigationInstructions = ['No suitable jeepney route found to this spot.'];
      this.navigating = false;
      return;
    }

    // 4. Show walking route to start
    if (this.walkLine) this.map.removeLayer(this.walkLine);
    if (this.stopMarker) this.map.removeLayer(this.stopMarker);
    
    this.stopMarker = L.marker([bestStart.lat, bestStart.lng], {
      icon: L.icon({
        iconUrl: 'assets/leaflet/marker-icon.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: 'jeepney-stop-marker'
      })
    }).addTo(this.map);

    this.walkLine = L.polyline([
      [userLoc.lat, userLoc.lng],
      [bestStart.lat, bestStart.lng]
    ], { color: 'green', weight: 4, dashArray: '5, 10' }).addTo(this.map);

    // 5. Show jeepney route
    if (this.jeepneyLine) this.map.removeLayer(this.jeepneyLine);
    this.jeepneyLine = L.polyline(
      bestRoute.points.map((p: any) => [p.lat, p.lng]),
      { color: 'orange', weight: 5 }
    ).addTo(this.map);

    // 6. Show instructions with day and spot info
    this.navigationInstructions = [
      `<b>Day ${day.day} - ${targetSpot.name}</b>`,
      `Time: ${targetSpot.timeSlot}`,
      `Walk to jeepney stop at (${bestStart.lat.toFixed(5)}, ${bestStart.lng.toFixed(5)})`,
      `Take jeepney code <b>${bestRoute.code}</b>`,
      `Get off at your destination: ${targetSpot.name}`,
      `Estimated duration: ${targetSpot.estimatedDuration}`
    ];

    // 7. Fit map to show the entire route
    this.map.fitBounds([
      [userLoc.lat, userLoc.lng],
      [bestStart.lat, bestStart.lng],
      ...bestRoute.points.map((p: any) => [p.lat, p.lng])
    ], { padding: [50, 50] });

    this.navigating = false;
  }

  // Helper method to get current day based on itinerary start date
  getCurrentDayIndex(): number {
    // For now, return 0 (first day) - this can be enhanced later
    // to calculate based on actual start date vs current date
    return 0;
  }

  // Helper method to get next unvisited spot for a given day
  getNextUnvisitedSpot(dayIndex: number): number {
    const day = this.itinerary[dayIndex];
    if (!day || !day.spots) return 0;
    
    // For now, return the first spot - this can be enhanced later
    // to track visited spots and return the next unvisited one
    return 0;
  }

  getDistance(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
    // Haversine formula
    const R = 6371e3;
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
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
