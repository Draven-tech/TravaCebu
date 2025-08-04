import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlacesService } from '../services/places.service';

@Component({
  selector: 'app-search-modal',
  standalone: false,
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Search Tourist Spots</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Search Input -->
      <div class="search-input-container">
        <ion-searchbar 
          [(ngModel)]="searchTerm" 
          placeholder="Enter tourist spot name..."
          (ionInput)="onSearchInput($event)"
          [debounce]="500">
        </ion-searchbar>
      </div>

      <!-- Loading State -->
      <div class="loading-container" *ngIf="isSearching">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Searching for tourist spots...</p>
      </div>

             <!-- Search Results -->
       <div class="search-results" *ngIf="!isSearching && searchResults.length > 0">
         <h3>Search Results for "{{ searchTerm }}"</h3>
         <div class="results-grid">
           <div *ngFor="let result of searchResults; let i = index" 
                class="result-card" 
                [class.existing-spot-card]="isExistingSpot(result)"
                (click)="!isExistingSpot(result) && addToDatabase(result)">
             <div class="result-image">
               <img 
                 [src]="getPlaceImageUrl(result)" 
                 [alt]="result.name"
                 (error)="onImageError($event, result)"
                 class="place-image">
               
                               <!-- Existing Spot Badge -->
                <div class="existing-spot-badge" *ngIf="isExistingSpot(result)">
                  <ion-icon name="checkmark-circle" slot="start"></ion-icon>
                  Already Added
                </div>
               
               <div class="image-overlay">
                 <ion-button 
                   fill="clear" 
                   size="small" 
                   color="light"
                   (click)="!isExistingSpot(result) && addToDatabase(result); $event.stopPropagation()">
                   <ion-icon name="add-circle" slot="start" *ngIf="!isExistingSpot(result)"></ion-icon>
                   <ion-icon name="checkmark-circle" slot="start" *ngIf="isExistingSpot(result)"></ion-icon>
                   {{ isExistingSpot(result) ? 'Already Added' : 'Add to Database' }}
                 </ion-button>
               </div>
             </div>
             <div class="result-details">
               <h4 class="place-name">{{ result.name }}</h4>
               <p class="place-address">
                 <ion-icon name="location-outline"></ion-icon>
                 {{ result.formatted_address || 'Cebu, Philippines' }}
               </p>
               <div class="place-rating" *ngIf="result.rating">
                 <ion-icon name="star" color="warning"></ion-icon>
                 <span>{{ result.rating }}</span>
                 <span class="rating-count" *ngIf="result.user_ratings_total">
                   ({{ result.user_ratings_total }} reviews)
                 </span>
               </div>
               <div class="place-types" *ngIf="result.types">
                 <ion-chip size="small" color="medium" *ngFor="let type of getDisplayTypes(result.types)">
                   {{ type }}
                 </ion-chip>
               </div>
             </div>
           </div>
         </div>
       </div>

      <!-- No Results -->
      <div class="no-results" *ngIf="!isSearching && searchResults.length === 0 && searchTerm">
        <ion-icon name="search-outline" class="no-results-icon"></ion-icon>
        <h3>No results found</h3>
        <p>Try searching with a different name or check your spelling.</p>
      </div>

      <!-- Initial State -->
      <div class="initial-state" *ngIf="!isSearching && searchResults.length === 0 && !searchTerm">
        <ion-icon name="search-outline" class="initial-icon"></ion-icon>
        <h3>Search for Tourist Spots</h3>
        <p>Enter the name of a tourist spot in Cebu to find and add it to our database.</p>
        <div class="search-examples">
          <ion-chip size="small" color="light" (click)="searchTerm = 'SM Seaside'">
            SM Seaside
          </ion-chip>
                     <ion-chip size="small" color="light" (click)="searchTerm = 'Magellans Cross'">
             Magellan's Cross
           </ion-chip>
          <ion-chip size="small" color="light" (click)="searchTerm = 'Fort San Pedro'">
            Fort San Pedro
          </ion-chip>
        </div>
      </div>
    </ion-content>
  `,
     styles: [`
     ion-content {
       --background: #ffffff;
       background: #ffffff;
     }

           .search-input-container {
        margin-bottom: 20px;
      }

      .search-input-container ion-searchbar {
        --color: #333333;
        --placeholder-color: #666666;
        --icon-color: #666666;
        --clear-button-color: #666666;
        --background: #f8f8f8;
        --border-radius: 12px;
        --box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .search-input-container ion-searchbar::ng-deep {
        .searchbar-input {
          color: #333333 !important;
          font-weight: 500;
        }
        
        .searchbar-input::placeholder {
          color: #666666 !important;
        }
        
        .searchbar-search-icon {
          color: #666666 !important;
        }
        
        .searchbar-clear-button {
          color: #666666 !important;
        }
      }

     .loading-container {
       text-align: center;
       padding: 40px 20px;
     }

     .loading-container ion-spinner {
       margin-bottom: 16px;
     }

     .loading-container p {
       color: #333;
       font-size: 16px;
     }

     .search-results h3 {
       margin-bottom: 16px;
       color: #333;
       font-weight: 600;
       font-size: 18px;
     }

     .results-grid {
       display: flex;
       flex-direction: column;
       gap: 16px;
     }

     .result-card {
       background: #fff;
       border-radius: 12px;
       box-shadow: 0 2px 8px rgba(0,0,0,0.1);
       overflow: hidden;
       border: 1px solid #e0e0e0;
       cursor: pointer;
       transition: transform 0.2s ease, box-shadow 0.2s ease;
     }

     .result-card:active {
       transform: scale(0.98);
       box-shadow: 0 1px 4px rgba(0,0,0,0.2);
     }

     .result-image {
       position: relative;
       height: 200px;
       overflow: hidden;
     }

     .place-image {
       width: 100%;
       height: 100%;
       object-fit: cover;
     }

     .image-overlay {
       position: absolute;
       top: 0;
       left: 0;
       right: 0;
       bottom: 0;
       background: rgba(0,0,0,0.5);
       display: flex;
       align-items: center;
       justify-content: center;
       opacity: 0;
       transition: opacity 0.3s ease;
     }

     .result-image:hover .image-overlay,
     .result-image:active .image-overlay {
       opacity: 1;
     }

     .result-details {
       padding: 16px;
     }

     .place-name {
       margin: 0 0 8px 0;
       font-size: 18px;
       font-weight: 600;
       color: #333;
     }

     .place-address {
       margin: 0 0 8px 0;
       color: #666;
       font-size: 14px;
       display: flex;
       align-items: center;
       gap: 4px;
     }

     .place-rating {
       display: flex;
       align-items: center;
       gap: 4px;
       margin-bottom: 8px;
       font-size: 14px;
       color: #666;
     }

     .rating-count {
       color: #999;
       font-size: 12px;
     }

     .place-types {
       display: flex;
       flex-wrap: wrap;
       gap: 4px;
     }

     .no-results, .initial-state {
       text-align: center;
       padding: 40px 20px;
     }

     .no-results-icon, .initial-icon {
       font-size: 64px;
       color: #ccc;
       margin-bottom: 16px;
     }

     .no-results h3, .initial-state h3 {
       margin-bottom: 8px;
       color: #333;
       font-size: 20px;
       font-weight: 600;
     }

     .no-results p, .initial-state p {
       color: #666;
       margin-bottom: 20px;
       font-size: 16px;
       line-height: 1.5;
     }

     .search-examples {
       display: flex;
       flex-wrap: wrap;
       gap: 8px;
       justify-content: center;
     }

     .search-examples ion-chip {
       cursor: pointer;
       --background: #f0f0f0;
       --color: #333;
       font-weight: 500;
     }

     .search-examples ion-chip:hover {
       --background: #e0e0e0;
     }

           .existing-spot-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ff4444;
        color: white;
        padding: 6px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .existing-spot-badge ion-icon {
        font-size: 14px;
      }

     .existing-spot-card {
       opacity: 0.7;
       pointer-events: none;
     }

     .existing-spot-card .image-overlay {
       background: rgba(255, 68, 68, 0.8);
       opacity: 1;
     }

     .existing-spot-card .image-overlay ion-button {
       --color: white;
       font-weight: 600;
     }
   `]
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
    if (!this.existingSpots || this.existingSpots.length === 0) {
      return false;
    }
    
    const placeName = place.name?.toLowerCase().trim();
    if (!placeName) return false;
    
    // Check for exact match
    const exactMatch = this.existingSpots.find(spot => 
      spot.name?.toLowerCase().trim() === placeName
    );
    if (exactMatch) return true;
    
    // Check for partial matches (one name contains the other)
    const partialMatch = this.existingSpots.find(spot => {
      const existingName = spot.name?.toLowerCase().trim();
      if (!existingName) return false;
      
      // Check if one name contains the other (for variations like "SM Seaside" vs "SM Seaside City Cebu")
      return placeName.includes(existingName) || existingName.includes(placeName);
    });
    
    if (partialMatch) return true;
    
    // Check for similar names (common words match)
    const placeWords = placeName.split(' ').filter((word: string) => word.length > 2);
    const similarMatch = this.existingSpots.find(spot => {
      const existingName = spot.name?.toLowerCase().trim();
      if (!existingName) return false;
      
      const existingWords = existingName.split(' ').filter((word: string) => word.length > 2);
      
      // Check if they share significant words
      const commonWords = placeWords.filter((word: string) => existingWords.includes(word));
      return commonWords.length >= Math.min(2, Math.min(placeWords.length, existingWords.length));
    });
    
    return !!similarMatch;
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