import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ItineraryEditorComponent } from './itinerary-editor.component';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';
import { ChangeDetectorRef } from '@angular/core';
import { ItineraryMapComponent } from './itinerary-map.component';

@Component({
  selector: 'app-itinerary-modal',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Your Itinerary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="editItinerary()">
            <ion-icon name="create-outline"></ion-icon>
            Edit
          </ion-button>
          <ion-button (click)="close()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="itinerary-container">
        <div *ngFor="let day of itinerary" class="day-section">
          <h3 class="day-title">Day {{ day.day }}</h3>
          <div *ngFor="let spot of day.spots; let i = index" class="spot-item">
            <div class="spot-name">{{ i + 1 }}. {{ spot.name }}</div>
            <div class="spot-details">
              <span class="time">⏰ {{ spot.timeSlot }}</span>
              <span class="duration">⏱️ {{ spot.estimatedDuration }}</span>
            </div>
            <div class="spot-category">📍 {{ spot.category }}</div>
            <!-- Selected Restaurant Card -->
            <div *ngIf="spot.mealType && spot.chosenRestaurant" class="selected-card restaurant-card">
              <div class="card-header">
                <ion-icon name="restaurant" color="warning"></ion-icon>
                <span class="card-title">Selected Restaurant</span>
                <ion-button size="small" fill="clear" color="danger" (click)="clearRestaurantChoice(spot)">
                  <ion-icon name="close"></ion-icon>
                </ion-button>
              </div>
              <div class="card-content">
                <div class="place-name">{{ spot.chosenRestaurant.name }}</div>
                <div class="place-details">
                  <span *ngIf="spot.chosenRestaurant.rating">⭐ {{ spot.chosenRestaurant.rating }}★</span>
                  <span *ngIf="spot.chosenRestaurant.vicinity">📍 {{ spot.chosenRestaurant.vicinity }}</span>
                  <span class="meal-time">🍽️ {{ spot.mealType }} time</span>
                </div>
                                  <div class="booking-links">
                    <ion-button size="small" fill="outline" color="primary" (click)="viewRestaurantMap(spot.chosenRestaurant)">
                      <ion-icon name="map"></ion-icon> View on Map
                    </ion-button>
                    <a [href]="getGoogleReviewsUrl(spot.chosenRestaurant)" target="_blank" class="booking-link">
                      <ion-icon name="star"></ion-icon> Reviews
                    </a>
                  </div>
              </div>
            </div>

            <!-- Restaurant Suggestions -->
            <div *ngIf="spot.mealType && !spot.chosenRestaurant && spot.restaurantSuggestions && spot.restaurantSuggestions.length > 0" class="suggestions-section">
              <div class="suggestions-header">
                <ion-icon name="restaurant-outline" color="warning"></ion-icon>
                <span>Restaurant Options ({{ spot.mealType }})</span>
              </div>
              <div class="suggestions-grid">
                <div *ngFor="let rest of spot.restaurantSuggestions | slice:0:3" class="suggestion-card">
                  <div class="suggestion-name">{{ rest.name }}</div>
                  <div class="suggestion-details">
                    <span *ngIf="rest.rating">⭐ {{ rest.rating }}★</span>
                    <span *ngIf="rest.vicinity">📍 {{ rest.vicinity }}</span>
                  </div>
                  <div class="suggestion-actions">
                    <ion-button size="small" fill="outline" color="success" (click)="chooseRestaurant(spot, rest)">
                      <ion-icon name="add"></ion-icon> Add to Itinerary
                    </ion-button>
                    <ion-button size="small" fill="outline" color="primary" (click)="viewRestaurantMap(rest)">
                      <ion-icon name="map-outline"></ion-icon> Map
                    </ion-button>
                    <ion-button size="small" fill="outline" color="warning" (click)="searchRestaurant(rest)">
                      <ion-icon name="search-outline"></ion-icon> Search
                    </ion-button>
                  </div>
                </div>
              </div>
              <ion-button size="small" fill="clear" color="medium" (click)="skipRestaurant(spot)">
                <ion-icon name="close-circle-outline"></ion-icon> Skip for now
              </ion-button>
            </div>

            <!-- No Restaurant Suggestions -->
            <div *ngIf="spot.mealType && !spot.chosenRestaurant && (!spot.restaurantSuggestions || spot.restaurantSuggestions.length === 0)" class="no-suggestions">
              <ion-icon name="restaurant-outline" color="medium"></ion-icon>
              <span>Restaurant suggestions will appear here after saving.</span>
            </div>
          </div>
          <!-- Selected Hotel Card -->
          <div *ngIf="day.chosenHotel" class="selected-card hotel-card">
            <div class="card-header">
              <ion-icon name="bed" color="primary"></ion-icon>
              <span class="card-title">Selected Hotel (End of Day)</span>
              <ion-button size="small" fill="clear" color="danger" (click)="clearHotelChoice(day)">
                <ion-icon name="close"></ion-icon>
              </ion-button>
            </div>
            <div class="card-content">
              <div class="place-name">{{ day.chosenHotel.name }}</div>
              <div class="place-details">
                <span *ngIf="day.chosenHotel.rating">⭐ {{ day.chosenHotel.rating }}★</span>
                <span *ngIf="day.chosenHotel.vicinity">📍 {{ day.chosenHotel.vicinity }}</span>
                <span class="check-in-time">🛏️ Check-in: Evening</span>
              </div>
                                <div class="booking-links">
                    <a [href]="getBookingUrl(day.chosenHotel)" target="_blank" class="booking-link">
                      <ion-icon name="card"></ion-icon> Booking.com
                    </a>
                    <a [href]="getAgodaUrl(day.chosenHotel)" target="_blank" class="booking-link">
                      <ion-icon name="bed"></ion-icon> Agoda
                    </a>
                    <ion-button size="small" fill="outline" color="primary" (click)="viewHotelMap(day.chosenHotel)">
                      <ion-icon name="map"></ion-icon> View on Map
                    </ion-button>
                  </div>
            </div>
          </div>

          <!-- Hotel Suggestions -->
          <div *ngIf="!day.chosenHotel && day.hotelSuggestions && day.hotelSuggestions.length > 0" class="suggestions-section">
            <div class="suggestions-header">
              <ion-icon name="bed-outline" color="primary"></ion-icon>
              <span>Hotel Options (End of Day)</span>
            </div>
            <div class="suggestions-grid">
              <div *ngFor="let hotel of day.hotelSuggestions | slice:0:3" class="suggestion-card">
                <div class="suggestion-name">{{ hotel.name }}</div>
                <div class="suggestion-details">
                  <span *ngIf="hotel.rating">⭐ {{ hotel.rating }}★</span>
                  <span *ngIf="hotel.vicinity">📍 {{ hotel.vicinity }}</span>
                </div>
                <div class="suggestion-actions">
                  <ion-button size="small" fill="outline" color="success" (click)="chooseHotel(day, hotel)">
                    <ion-icon name="add"></ion-icon> Add to Itinerary
                  </ion-button>
                  <ion-button size="small" fill="outline" color="primary" (click)="viewHotelMap(hotel)">
                    <ion-icon name="map-outline"></ion-icon> Map
                  </ion-button>
                  <ion-button size="small" fill="outline" color="warning" (click)="searchHotel(hotel)">
                    <ion-icon name="search-outline"></ion-icon> Search
                  </ion-button>
                </div>
              </div>
            </div>
            <ion-button size="small" fill="clear" color="medium" (click)="skipHotel(day)">
              <ion-icon name="close-circle-outline"></ion-icon> Skip for now
            </ion-button>
          </div>

          <!-- No Hotel Suggestions -->
          <div *ngIf="(!day.hotelSuggestions || day.hotelSuggestions.length === 0) && day.spots.length > 0" class="no-suggestions">
            <ion-icon name="bed-outline" color="medium"></ion-icon>
            <span>Hotel suggestions will appear here after saving.</span>
          </div>
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" color="success" (click)="fetchSuggestions()" [disabled]="fetchingSuggestions">
          <ion-spinner *ngIf="fetchingSuggestions" name="crescent"></ion-spinner>
          <span *ngIf="!fetchingSuggestions">Save & Fetch Suggestions</span>
        </ion-button>
        <ion-button expand="block" color="primary" (click)="viewMap()">
          <ion-icon name="map"></ion-icon>
          View Map & Distances
        </ion-button>
        <ion-button expand="block" color="warning" (click)="saveToNotes()">
          Save to Notes
        </ion-button>
        <ion-button expand="block" fill="clear" (click)="close()">
          Close
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .itinerary-container {
      padding: 16px;
    }
    .day-section {
      margin-bottom: 24px;
    }
    .day-title {
      color: #e74c3c;
      font-size: 1.3rem;
      font-weight: 700;
      margin: 16px 0 12px 0;
      border-bottom: 2px solid #e74c3c;
      padding-bottom: 8px;
    }
    .spot-item {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      border-left: 4px solid #e74c3c;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .spot-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D3748;
      margin-bottom: 8px;
    }
    .spot-details {
      margin-bottom: 6px;
    }
    .time, .duration {
      color: #6c757d;
      font-size: 0.9rem;
      margin-right: 16px;
    }
    .spot-category {
      color: #e74c3c;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .restaurant-section {
      margin-top: 8px;
      font-size: 0.95rem;
    }
    .restaurant-title {
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 4px;
    }
    .hotel-section {
      margin-top: 16px;
      font-size: 0.95rem;
    }
    .hotel-title {
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 4px;
    }

    /* Selected Cards */
    .selected-card {
      background: #ffffff;
      border-radius: 12px;
      margin: 12px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 2px solid;
      overflow: hidden;
    }

    .restaurant-card {
      border-color: #FF9800;
    }

    .hotel-card {
      border-color: #1976D2;
    }

    .card-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.05);
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }

    .card-title {
      flex: 1;
      font-weight: 600;
      margin-left: 8px;
      color: #2D3748;
    }

    .card-content {
      padding: 16px;
    }

    .place-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D3748;
      margin-bottom: 8px;
    }

    .place-details {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
      font-size: 0.9rem;
      color: #666;
    }

    .meal-time, .check-in-time {
      color: #FF9800;
      font-weight: 600;
    }

    .booking-links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .booking-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      color: #495057;
      text-decoration: none;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .booking-link:hover {
      background: #e9ecef;
      border-color: #adb5bd;
    }

    /* Suggestions Section */
    .suggestions-section {
      margin-top: 16px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;
      border: 1px solid #dee2e6;
    }

    .suggestions-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: #2D3748;
    }

    .suggestions-grid {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }

    .suggestion-card {
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #dee2e6;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .suggestion-name {
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 6px;
    }

    .suggestion-details {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 0.85rem;
      color: #666;
    }

    .suggestion-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .map-link, .booking-link-small {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      color: #495057;
      text-decoration: none;
      transition: all 0.2s;
    }

    .map-link:hover, .booking-link-small:hover {
      background: #e9ecef;
      border-color: #adb5bd;
    }

    /* No Suggestions */
    .no-suggestions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      color: #6c757d;
      font-style: italic;
    }
    
    /* Map modal styles */
    :global(.map-modal) {
      --height: 90%;
      --width: 90%;
      --max-width: 800px;
    }
  `],
  standalone: false
})
export class ItineraryModalComponent {
  @Input() itinerary: ItineraryDay[] = [];
  fetchingSuggestions = false;

  constructor(
    private modalCtrl: ModalController, 
    private itineraryService: ItineraryService, 
    private cdr: ChangeDetectorRef
  ) {}

  async fetchSuggestions() {
    this.fetchingSuggestions = true;
    try {
      console.log('Fetching suggestions for itinerary:', this.itinerary);
      this.itinerary = await this.itineraryService.fetchSuggestionsForItinerary(this.itinerary);
      this.cdr.detectChanges();
      console.log('Suggestions fetched successfully:', this.itinerary);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Show user-friendly error message
      this.showAlert('Error', 'Failed to fetch suggestions. Please try again.');
    } finally {
      this.fetchingSuggestions = false;
    }
  }

  chooseRestaurant(spot: ItinerarySpot, restaurant: any) {
    spot.chosenRestaurant = restaurant;
  }
  skipRestaurant(spot: ItinerarySpot) {
    spot.chosenRestaurant = { name: 'User will decide on the day' };
  }
  clearRestaurantChoice(spot: ItinerarySpot) {
    spot.chosenRestaurant = undefined;
  }

  chooseHotel(day: ItineraryDay, hotel: any) {
    day.chosenHotel = hotel;
  }
  skipHotel(day: ItineraryDay) {
    day.chosenHotel = { name: 'User will decide on the day' };
  }
  clearHotelChoice(day: ItineraryDay) {
    day.chosenHotel = undefined;
  }

  async editItinerary() {
    // Get all spots from the itinerary to use as available spots
    const allSpots = this.itinerary.reduce((spots: any[], day: ItineraryDay) => {
      return spots.concat(day.spots);
    }, []);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryEditorComponent,
      componentProps: {
        itinerary: this.itinerary,
        availableSpots: allSpots // Pass all spots as available for editing
      },
      cssClass: 'itinerary-editor-modal'
    });
    modal.onDidDismiss().then(result => {
      if (result.data) {
        this.itinerary = result.data;
      }
    });
    await modal.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }

  saveToNotes() {
    let notes = '=== MY CEBU ITINERARY ===\n\n';
    this.itinerary.forEach(day => {
      notes += `DAY ${day.day}\n`;
      notes += '='.repeat(20) + '\n';
      day.spots.forEach((spot: any, index: number) => {
        notes += `${index + 1}. ${spot.name}\n`;
        notes += `   Time: ${spot.timeSlot}\n`;
        notes += `   Duration: ${spot.estimatedDuration}\n`;
        notes += `   Category: ${spot.category}\n`;
        if (spot.description) {
          notes += `   Notes: ${spot.description}\n`;
        }
        if (spot.chosenRestaurant) {
          notes += `   Restaurant: ${spot.chosenRestaurant.name}\n`;
        }
        notes += '\n';
      });
      if (day.chosenHotel) {
        notes += `Hotel: ${day.chosenHotel.name}\n`;
      }
      notes += '\n';
    });
    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(notes).then(() => {
        this.showAlert('Saved!', 'Itinerary copied to clipboard. You can paste it in your notes app.');
      }).catch(() => {
        this.showAlert('Itinerary Generated', 'Please manually copy the itinerary.');
      });
    } else {
      this.showAlert('Itinerary Generated', 'Please manually copy the itinerary.');
    }
  }

  getGoogleMapsUrl(place: any): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
  }

  getBookingUrl(hotel: any): string {
    return `https://www.booking.com/search.html?ss=${encodeURIComponent(hotel.name || 'hotel')}`;
  }

  getAgodaUrl(hotel: any): string {
    return `https://www.agoda.com/search?q=${encodeURIComponent(hotel.name || 'hotel')}`;
  }

  getGoogleReviewsUrl(place: any): string {
    return `https://www.google.com/search?q=${encodeURIComponent((place.name || 'restaurant') + ' reviews')}`;
  }

  async viewMap() {
    const mapModal = await this.modalCtrl.create({
      component: ItineraryMapComponent,
      componentProps: {
        itinerary: this.itinerary
      },
      cssClass: 'map-modal'
    });
    await mapModal.present();
  }

  async viewRestaurantMap(restaurant: any) {
    const mapModal = await this.modalCtrl.create({
      component: ItineraryMapComponent,
      componentProps: {
        itinerary: this.itinerary,
        highlightPlace: restaurant
      },
      cssClass: 'map-modal'
    });
    await mapModal.present();
  }

  async viewHotelMap(hotel: any) {
    const mapModal = await this.modalCtrl.create({
      component: ItineraryMapComponent,
      componentProps: {
        itinerary: this.itinerary,
        highlightPlace: hotel
      },
      cssClass: 'map-modal'
    });
    await mapModal.present();
  }

  searchRestaurant(restaurant: any) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(restaurant.name + ' restaurant reviews menu')}`;
    window.open(searchUrl, '_blank');
  }

  searchHotel(hotel: any) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(hotel.name + ' hotel reviews booking')}`;
    window.open(searchUrl, '_blank');
  }

  private async showAlert(header: string, message: string) {
    // You can implement a simple alert here or use a toast
    console.log(`${header}: ${message}`);
  }
} 