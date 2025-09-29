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
  isRefreshing = false;
  imageErrors: Set<number> = new Set(); // Track which images failed to load

  constructor(
    private modalCtrl: ModalController,
    private placesImageService: PlacesImageService
  ) {}

  ngOnInit() {
    if (this.spot) {
      this.loadEnhancedSpot();
    }
  }

  private loadEnhancedSpot(forceRefresh: boolean = false) {
    this.isLoading = true;
    this.imageErrors.clear();
    
    // Clear cache if force refresh is requested
    if (forceRefresh) {
      this.placesImageService.clearSpotCache(this.spot.id);
    }
    
    this.placesImageService.enhanceTouristSpot(this.spot).subscribe({
      next: (enhancedSpot) => {
        this.enhancedSpot = enhancedSpot;
        this.allImages = this.placesImageService.getAllImages(enhancedSpot);
        this.isLoading = false;
        this.isRefreshing = false;
        },
      error: (error) => {
        console.error('Error enhancing spot:', error);
        this.enhancedSpot = this.spot;
        this.allImages = this.placesImageService.getAllImages(this.spot);
        this.isLoading = false;
        this.isRefreshing = false;
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

  hasGoogleImages(): boolean {
    return !!(this.enhancedSpot?.googleImages && this.enhancedSpot.googleImages.length > 0);
  }

  // Refresh images from Google Places
  refreshImages() {
    this.isRefreshing = true;
    this.loadEnhancedSpot(true);
  }

  // Handle image load errors
  onImageError(index: number) {
    console.warn(`Image ${index} failed to load:`, this.allImages[index]?.url);
    this.imageErrors.add(index);
    
    // Mark the photo reference as broken if it's a Google Places image
    const failedImage = this.allImages[index];
    if (failedImage?.isGooglePlace && failedImage.photoReference) {
      this.placesImageService.markImageAsBroken(failedImage.photoReference);
    }
    
    // If current image failed, try to show next available image
    if (index === this.currentImageIndex) {
      this.showNextValidImage();
    }
  }

  // Show next valid image if current one failed
  private showNextValidImage() {
    for (let i = 0; i < this.allImages.length; i++) {
      if (!this.imageErrors.has(i)) {
        this.currentImageIndex = i;
        return;
      }
    }
    // If all images failed, stay on current index (will show default)
  }

  // Check if current image has an error
  isCurrentImageError(): boolean {
    return this.imageErrors.has(this.currentImageIndex);
  }

  // Check if any images have errors
  hasImageErrors(): boolean {
    return this.imageErrors.size > 0;
  }

  // Get working images count
  getWorkingImagesCount(): number {
    return this.allImages.length - this.imageErrors.size;
  }
}
