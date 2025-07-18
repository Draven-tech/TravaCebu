import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-tourist-spot-editor',
  templateUrl: './tourist-spot-editor.page.html',
  styleUrls: ['./tourist-spot-editor.page.scss'],
})
export class TouristSpotEditorPage implements OnInit, OnDestroy {
  private map!: L.Map;
  private marker?: L.Marker;
  spot: any;
  
  // Default coordinates (Cebu)
  defaultLat = 10.3157;
  defaultLng = 123.8854;
  defaultZoom = 14;
  
  // Spot properties
  spotName: string = '';
  spotDescription: string = '';
  spotCategory: string = 'attraction';
  isEditing = false;
  spotId?: string;

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

  selectedTile: string = 'esri';
  private tileLayer?: L.TileLayer;

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private activatedRoute: ActivatedRoute,
    private navCtrl: NavController
  ) {}

  private destroyMap() {
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
    this.marker = undefined;
    this.tileLayer = undefined;
  }

  ngOnInit() {
    // Check for edit mode
    const nav = window.history.state;
    setTimeout(() => {
      this.destroyMap();
      if (nav && nav.spot) {
        const spot = nav.spot;
        this.isEditing = true;
        this.spotId = spot.id;
        this.spotName = spot.name;
        this.spotDescription = spot.description;
        this.spotCategory = spot.category;
        this.spot = spot; // Fix: set the whole spot object for createdAt
        this.initMap();
        if (spot.location) {
          this.addPin(L.latLng(spot.location.lat, spot.location.lng));
          this.map.setView([spot.location.lat, spot.location.lng], this.defaultZoom);
        }
      } else {
        this.initMap();
      }
    }, 0);
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  private checkForEdit() {
    const state = this.activatedRoute.snapshot.paramMap.get('state');
    if (state) {
      const spot = JSON.parse(state);
      this.isEditing = true;
      this.spotId = spot.id;
      this.spotName = spot.name;
      this.spotDescription = spot.description;
      this.spotCategory = spot.category;
      
      if (spot.location) {
        this.addPin(L.latLng(spot.location.lat, spot.location.lng));
        this.map.setView([spot.location.lat, spot.location.lng], this.defaultZoom);
      }
    }
  }

  private initMap() {
    this.map = L.map('tourist-spot-map', {
      center: [this.defaultLat, this.defaultLng],
      zoom: this.defaultZoom,
      preferCanvas: true
    });
    this.addTileLayer();
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addPin(e.latlng);
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
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    this.marker = L.marker(latlng, {
      draggable: true,
      icon: this.customIcon,
      autoPan: true
    }).addTo(this.map);

    this.marker.bindPopup(`
      <div style="text-align: center;">
        <strong>Tourist Spot</strong><br>
        ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}
      </div>
    `);

    this.marker.on('dragend', () => {
      const newPos = this.marker?.getLatLng();
      if (newPos) {
        this.marker?.setPopupContent(`
          <div style="text-align: center;">
            <strong>Tourist Spot</strong><br>
            ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}
          </div>
        `);
      }
    });
  }

  async saveSpot() {
    if (!this.spotName || this.spotName.trim().length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Spot Name',
        message: 'Please enter a name for the tourist spot',
        buttons: ['OK']
      });
      return await alert.present();
    }

    if (!this.marker) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Location',
        message: 'Please select a location on the map',
        buttons: ['OK']
      });
      return await alert.present();
    }

    try {
      const latlng = this.marker.getLatLng();
      const spotData = {
        name: this.spotName.trim(),
        description: this.spotDescription.trim(),
        category: this.spotCategory,
        location: { lat: latlng.lat, lng: latlng.lng },
        createdAt: this.isEditing ? this.spot.createdAt : new Date(),
        updatedAt: new Date()
      };
  
      console.log('Attempting to save:', spotData); // Add this line
  
      if (this.isEditing && this.spotId) {
        await this.firestore.collection('tourist_spots').doc(this.spotId).update(spotData);
      } else {
        await this.firestore.collection('tourist_spots').add(spotData);
      }

      const alert = await this.alertCtrl.create({
        header: 'Success',
        message: `Tourist Spot ${this.spotName} saved!`,
        buttons: ['OK']
      });
      await alert.present();

    } catch (error: unknown) { // Explicitly type as unknown
      let errorMessage = 'Failed to save spot. Please try again.';
      
      if (error instanceof Error) {
        console.error('Firestore error details:', error.message, error.stack);
        errorMessage = `Failed to save spot: ${error.message}`;
      } else {
        console.error('Unknown error:', error);
      }
      
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  clearSpot() {
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }
    
    this.spotName = '';
    this.spotDescription = '';
    this.spotCategory = 'attraction';
    this.map.setView([this.defaultLat, this.defaultLng], this.defaultZoom);
  }
}