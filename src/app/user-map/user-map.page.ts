import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BucketService } from '../services/bucket-list.service';
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
  searchQuery: string = '';
  touristSpots: any[] = [];
  static toastCtrl: ToastController;
  static cmpRef: UserMapPage;
  public bucketService: BucketService;

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    bucketService: BucketService,
    private toastCtrl: ToastController
  ) {
    this.bucketService = bucketService;
    UserMapPage.toastCtrl = toastCtrl;
    UserMapPage.cmpRef = this;
  }

  ngAfterViewInit(): void {
    if (!this.map) {
      setTimeout(() => {
        this.initMap();
      }, 100);
    }
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
      preferCanvas: true,
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
    }, 200);
  }

  private async loadTouristSpots(): Promise<void> {
    try {
      const spotsSnapshot = await this.firestore.collection('tourist_spots').get().toPromise();
      this.touristSpots = [];
      this.markers.forEach(m => this.map.removeLayer(m));
      this.markers = [];
      spotsSnapshot?.forEach((doc) => {
        const spot = { id: doc.id, ...(doc.data() as any) };
        this.touristSpots.push(spot);
      });
      this.showTouristSpots();
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
      marker.bindPopup(`
        <div style="text-align:center;min-width:200px;">
          <strong style='font-size:1.1em;'>${spot.name}</strong><br>
          <span style='font-size:0.95em;color:#e74c3c;'>${spot.category ? spot.category : ''}</span><br>
          <span style='font-size:0.9em;'>${spot.description ? spot.description : ''}</span><br>
          <span style='font-size:0.85em;color:#888;'>${spot.location.lat.toFixed(5)}, ${spot.location.lng.toFixed(5)}</span><br>
          <button onclick='window.addToBucketSpot("${spot.id}")' style='margin-top:8px;background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-weight:700;cursor:pointer;'>Add to Bucket List</button>
        </div>
      `);
      this.markers.push(marker);
    });
    if (filtered.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
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

  ngDoCheck() {
    this.showTouristSpots();
  }

  static async showToast(msg: string) {
    const toast = await UserMapPage.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: 'success',
      position: 'top',
    });
    toast.present();
  }
}

(window as any).addToBucketSpot = async (spotId: string) => {
  const cmp = UserMapPage.cmpRef;
  const spot = cmp.touristSpots.find((s: any) => s.id === spotId);
  if (spot) cmp.bucketService.addToBucket(spot);
  await UserMapPage.showToast('Added to bucket list!');
};
