import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController, AlertController } from '@ionic/angular';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-tourist-spot-detail',
  templateUrl: './tourist-spot-detail.page.html',
  styleUrls: ['./tourist-spot-detail.page.scss'],
  standalone: false,
})
export class TouristSpotDetailPage implements OnInit {
  @Input() spot: any;
  private map?: L.Map;
  private marker?: L.Marker;

  constructor(
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private firestore: AngularFirestore,
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    setTimeout(() => {
      this.destroyMap();
      if (this.spot && this.spot.location) {
        this.initMap();
      }
    }, 100);
  }

  private initMap() {
    if (!this.spot?.location) return;

    this.map = L.map('spot-detail-map', {
      center: [this.spot.location.lat, this.spot.location.lng],
      zoom: 15,
      preferCanvas: true
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Satellite Imagery © Esri',
      maxZoom: 19
    }).addTo(this.map);

    this.marker = L.marker([this.spot.location.lat, this.spot.location.lng], {
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

    this.marker.bindPopup(`
      <div style="text-align: center;">
        <strong>${this.spot.name}</strong><br>
        ${this.spot.location.lat.toFixed(5)}, ${this.spot.location.lng.toFixed(5)}
      </div>
    `).openPopup();
  }

  private destroyMap() {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    this.marker = undefined;
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  close() {
    this.modalCtrl.dismiss();
  }

  editSpot() {
    this.close();
    this.navCtrl.navigateForward(['/admin/tourist-spot-editor'], {
      state: { spotToEdit: this.spot }
    });
  }

  async confirmDeleteSpot() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Tourist Spot',
      message: 'THIS ACTION IS IRREVERSIBLE!\n\nAre you absolutely sure you want to permanently delete this tourist spot? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete Forever',
          role: 'destructive',
          handler: async () => {
            if (this.spot && this.spot.id) {
              await this.firestore.collection('tourist_spots').doc(this.spot.id).delete();
              this.close();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}