import { Component, Input, OnInit } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { PlacesImageService, EnhancedTouristSpot, PlaceImage } from '../services/places-image.service';

@Component({
  standalone: true,
  selector: 'app-tourist-spot-sheet',
  templateUrl: './tourist-spot-sheet.component.html',
  styleUrls: ['./tourist-spot-sheet.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class TouristSpotSheetComponent implements OnInit {
  @Input() spot: any;
  
  enhancedSpot?: EnhancedTouristSpot;
  allImages: PlaceImage[] = [];
  currentImageIndex = 0;
  isLoading = true;

  constructor(
    private modalCtrl: ModalController,
    private placesImageService: PlacesImageService
  ) {}

  ngOnInit() {
    if (this.spot) {
      this.loadEnhancedSpot();
    }
  }

  private loadEnhancedSpot() {
    this.isLoading = true;
    this.placesImageService.enhanceTouristSpot(this.spot).subscribe({
      next: (enhancedSpot) => {
        this.enhancedSpot = enhancedSpot;
        this.allImages = this.placesImageService.getAllImages(enhancedSpot);
        this.isLoading = false;
        console.log('Enhanced spot with Google images:', enhancedSpot);
      },
      error: (error) => {
        console.error('Error enhancing spot:', error);
        this.enhancedSpot = this.spot;
        this.allImages = this.placesImageService.getAllImages(this.spot);
        this.isLoading = false;
      }
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  back() {
    this.close();
  }

  addToBucket() {
    this.modalCtrl.dismiss({ addToBucket: true, spot: this.spot });
  }

  // Image gallery methods
  nextImage() {
    if (this.allImages.length > 1) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.allImages.length;
    }
  }

  previousImage() {
    if (this.allImages.length > 1) {
      this.currentImageIndex = this.currentImageIndex === 0 
        ? this.allImages.length - 1 
        : this.currentImageIndex - 1;
    }
  }

  selectImage(index: number) {
    this.currentImageIndex = index;
  }

  getCurrentImage(): string {
    if (this.allImages.length === 0) {
      return 'assets/img/default.png';
    }
    return this.allImages[this.currentImageIndex].url;
  }

  hasMultipleImages(): boolean {
    return this.allImages.length > 1;
  }

  getGoogleRating(): number | undefined {
    return this.enhancedSpot?.googleRating;
  }

  getGoogleUserRatings(): number | undefined {
    return this.enhancedSpot?.googleUserRatings;
  }

  hasGoogleData(): boolean {
    return !!(this.enhancedSpot?.googleRating || this.enhancedSpot?.googleUserRatings);
  }
} 