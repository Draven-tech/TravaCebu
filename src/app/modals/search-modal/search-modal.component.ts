import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlacesService } from '../../services/places.service';
import { isExistingOrNearbyDuplicatePlace } from '../../utils/place-duplicate.util';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html',
  styleUrls: ['./search-modal.component.scss'],
  standalone: false,
})
export class SearchModalComponent {
  @Input() existingSpots: any[] = [];
  searchTerm: string = '';
  searchResults: any[] = [];
  isSearching: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private placesService: PlacesService
  ) {}

  async onSearchInput(event: any) {
    const term = event.target.value?.trim();
    if (term && term.length > 2) {
      await this.searchPlaces(term);
    } else {
      this.searchResults = [];
    }
  }

  async searchPlaces(searchTerm: string) {
    this.isSearching = true;
    this.searchResults = [];

    try {
      const searchResult = await this.placesService.searchPlaceByName(
        searchTerm,
        10.3157, // Cebu City latitude
        123.8854  // Cebu City longitude
      ).toPromise();

      if (searchResult.results && searchResult.results.length > 0) {
        this.searchResults = searchResult.results.slice(0, 5); // Limit to 5 results
      }
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      this.isSearching = false;
    }
  }

  getPlaceImageUrl(place: any): string {
    if (place.photos && place.photos.length > 0) {
      return this.placesService.getPhotoUrl(place.photos[0].photo_reference);
    }
    return 'assets/img/default.png';
  }

  onImageError(event: any, place: any) {
    event.target.src = 'assets/img/default.png';
  }

  getDisplayTypes(types: string[]): string[] {
    if (!types) return [];
    
    const typeMap: { [key: string]: string } = {
      'shopping_mall': 'Mall',
      'amusement_park': 'Attraction',
      'aquarium': 'Attraction',
      'art_gallery': 'Museum',
      'museum': 'Museum',
      'park': 'Park',
      'natural_feature': 'Attraction',
      'tourist_attraction': 'Attraction',
      'point_of_interest': 'Attraction',
      'establishment': 'Attraction',
      'restaurant': 'Restaurant',
      'lodging': 'Hotel'
    };

    return types
      .map(type => typeMap[type])
      .filter(type => type)
      .slice(0, 3); // Limit to 3 types
  }

  isExistingSpot(place: any): boolean {
    return isExistingOrNearbyDuplicatePlace(place, this.existingSpots);
  }

  async addToDatabase(place: any) {
    if (this.isExistingSpot(place)) {
      return; // Don't add if already exists
    }
    
    // Add visual feedback - change button text temporarily
    const button = event?.target as HTMLElement;
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Adding...';
      button.setAttribute('disabled', 'true');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.removeAttribute('disabled');
      }, 1000);
    }
    
    this.modalCtrl.dismiss({ action: 'add', place });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
