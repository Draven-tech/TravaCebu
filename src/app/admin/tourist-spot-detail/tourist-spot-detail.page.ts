import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController, AlertController } from '@ionic/angular';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DatePipe } from '@angular/common';
import { StorageService } from '../../services/storage.service';

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
    private storageService: StorageService,
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
      attribution: 'Satellite Imagery Â© Esri',
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
      message: 'THIS ACTION IS IRREVERSIBLE!\n\nAre you absolutely sure you want to permanently delete this tourist spot? This will also delete the associated image. This cannot be undone.',
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
              try {
                // Delete the image from storage if it exists
                if (this.spot.img) {
                  await this.storageService.deleteFileByURL(this.spot.img);
                  }
                
                // Delete the Firestore document
                await this.firestore.collection('tourist_spots').doc(this.spot.id).delete();
                
                this.close();
              } catch (error) {
                console.error('Error deleting tourist spot:', error);
                // Still close the modal even if image deletion fails
                this.close();
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
