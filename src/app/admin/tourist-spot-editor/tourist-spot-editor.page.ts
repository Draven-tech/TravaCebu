import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController } from '@ionic/angular';
import * as L from 'leaflet';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-tourist-spot-editor',
  templateUrl: './tourist-spot-editor.page.html',
  styleUrls: ['./tourist-spot-editor.page.scss'],
  standalone: false,
})
export class TouristSpotEditorPage implements OnInit, OnDestroy {
  private map!: L.Map;
  private marker?: L.Marker;
  private tileLayer?: L.TileLayer;
  
  // Cebu coordinates
  defaultLat = 10.3157;
  defaultLng = 123.8854;
  defaultZoom = 15;
  
  // Tourist spot properties
  spotName: string = '';
  spotDescription: string = '';
  spotCategory: string = 'attraction';
  imageFile?: File;
  imageUrl: string = '';
  originalImageUrl: string = ''; // Track the original image URL for deletion
  isUploading: boolean = false;
  uploadProgress: number = 0;
  selectedTile: string = 'esri';
  
  // Edit mode tracking
  isEditing: boolean = false;
  editingSpotId: string = '';

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

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private storageService: StorageService
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
      if (nav && nav.spotToEdit) {
        const spot = nav.spotToEdit;
        this.isEditing = true;
        this.editingSpotId = spot.id;
        this.spotName = spot.name || '';
        this.spotDescription = spot.description || '';
        this.spotCategory = spot.category || 'attraction';
        this.imageUrl = spot.img || '';
        this.originalImageUrl = spot.img || ''; // Store original image URL
        this.initMap();
        if (spot.location) {
          this.addPin(L.latLng(spot.location.lat, spot.location.lng));
        }
      } else {
        this.isEditing = false;
        this.editingSpotId = '';
        this.initMap();
      }
    }, 0);
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  private initMap() {
    this.map = L.map('tourist-spot-editor-map', {
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
        <strong>Tourist Spot Location</strong><br>
        ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}
      </div>
    `);
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFile = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.imageFile = undefined;
    this.imageUrl = '';
    // Don't clear originalImageUrl here as we want to delete it when saving
  }

  private async uploadImage(): Promise<string> {
    // If no new image is selected and we're editing
    if (!this.imageFile) {
      // If we're editing and the image was removed, delete the original
      if (this.isEditing && this.originalImageUrl && !this.imageUrl) {
        await this.storageService.deleteFileByURL(this.originalImageUrl);
        console.log('Original image deleted due to removal:', this.originalImageUrl);
        return ''; // Return empty string for no image
      }
      return this.imageUrl || '';
    }
    
    this.isUploading = true;
    this.uploadProgress = 0;
    const filePath = `tourist_spots/${Date.now()}_${this.imageFile.name}`;
    
    try {
      const url = await this.storageService.uploadFile(filePath, this.imageFile);
      
      // If we're editing and there was a previous image, delete it
      if (this.isEditing && this.originalImageUrl && this.originalImageUrl !== url) {
        await this.storageService.deleteFileByURL(this.originalImageUrl);
        console.log('Old image deleted:', this.originalImageUrl);
      }
      
      return url;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw error;
    } finally {
      this.isUploading = false;
      this.uploadProgress = 100;
    }
  }

  async saveSpot() {
    if (!this.spotName.trim()) {
      this.showAlert('Error', 'Please enter a spot name');
      return;
    }

    if (!this.marker) {
      this.showAlert('Error', 'Please set a location on the map');
      return;
    }

    const latlng = this.marker.getLatLng();
    
    try {
      const imageUrl = await this.uploadImage();
      
      const spotData: any = {
        name: this.spotName.trim(),
        description: this.spotDescription.trim(),
        category: this.spotCategory,
        img: imageUrl,
        location: {
          lat: latlng.lat,
          lng: latlng.lng
        },
        updatedAt: new Date()
      };

      // Only add createdAt for new spots, not when editing
      if (!this.isEditing) {
        spotData.createdAt = new Date();
      }

      if (this.isEditing && this.editingSpotId) {
        await this.firestore.collection('tourist_spots').doc(this.editingSpotId).update(spotData);
      } else {
        await this.firestore.collection('tourist_spots').add(spotData);
      }

      this.showAlert('Success', `Tourist spot ${this.isEditing ? 'updated' : 'created'} successfully`);
      this.navCtrl.navigateBack(this.isEditing ? '/admin/tourist-spot-list' : '/admin/dashboard');
    } catch (error) {
      console.error('Error saving spot:', error);
      this.showAlert('Error', 'Failed to save tourist spot');
    }
  }

  clearSpot() {
    this.spotName = '';
    this.spotDescription = '';
    this.spotCategory = 'attraction';
    this.imageFile = undefined;
    this.imageUrl = '';
    this.originalImageUrl = '';
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }
  }

  removePin() {
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}