import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController, AlertController } from '@ionic/angular';
import * as L from 'leaflet';
import { DatePipe } from '@angular/common';
import { AngularFirestore } from '@angular/fire/compat/firestore';

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
    public datePipe: DatePipe,
    private firestore: AngularFirestore,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    setTimeout(() => {
      this.destroyMap();
      if (this.route && this.route.points && this.route.points.length > 0) {
        this.initMap();
      }
    }, 100);
  }

  private initMap() {
    if (!this.route?.points || this.route.points.length === 0) {
      // Optionally, show a message or fallback here
      return;
    }

    // Calculate center point
    const center = this.calculateCenter(this.route.points);
    
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
    this.route.points.forEach((pt: any) => {
      const marker = L.marker([pt.lat, pt.lng], {
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
    const points = this.route.points.map((pt: any) => [pt.lat, pt.lng]);
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

  private calculateCenter(points: any[]) {
    if (points.length === 0) return { lat: 0, lng: 0 };
    
    let latSum = 0;
    let lngSum = 0;
    
    points.forEach(pt => {
      latSum += pt.lat;
      lngSum += pt.lng;
    });
    
    return {
      lat: latSum / points.length,
      lng: lngSum / points.length
    };
  }

  private destroyMap() {
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
    this.markers = [];
    this.routeLine = undefined;
  }

  ngOnDestroy() {
    this.destroyMap();
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

  async confirmDeleteRoute() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Route',
      message: 'THIS ACTION IS IRREVERSIBLE!\n\nAre you absolutely sure you want to permanently delete this route? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete Forever',
          role: 'destructive',
          handler: async () => {
            if (this.route && this.route.id) {
              await this.firestore.collection('jeepney_routes').doc(this.route.id).delete();
              this.close();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}