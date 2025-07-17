import { Component, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { NavController, ToastController, ModalController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BucketService } from '../services/bucket-list.service';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from './tourist-spot-sheet.component';

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

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    bucketService: BucketService,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private modalCtrl: ModalController
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
}
