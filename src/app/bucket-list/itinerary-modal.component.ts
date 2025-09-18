import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { ItineraryEditorComponent } from './itinerary-editor.component';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';
import { ItineraryMapComponent } from './itinerary-map.component';
import { CalendarService, CalendarEvent } from '../services/calendar.service';

interface PlaceSuggestion {
  name: string;
  rating?: number;
  vicinity?: string;
  place_id?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

@Component({
  selector: 'app-itinerary-modal',
  template: `
    <ion-header>
      <ion-toolbar color="warning" style="--min-height: 32px; --padding-top: 2px; --padding-bottom: 2px; display: flex; align-items: center; justify-content: space-between;">
        <ion-title style="font-size: 1.1rem; font-weight: 700; text-align: center; flex: 1; padding: 0; margin: 0;">Your Itinerary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="editItinerary()" aria-label="Edit" style="--padding-start: 4px; --padding-end: 4px; --min-height: 28px;">
            <ion-icon name="create-outline" style="font-size: 16px;"></ion-icon>
          </ion-button>
          <ion-button (click)="close()" aria-label="Close" style="--padding-start: 4px; --padding-end: 4px; --min-height: 28px;">
            <ion-icon name="close" style="font-size: 16px;"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Loading suggestions indicator -->
      <div *ngIf="fetchingSuggestions" class="loading-suggestions">
        <ion-spinner name="crescent" color="warning"></ion-spinner>
        <span>Loading restaurant and hotel suggestions...</span>
      </div>

      <div class="itinerary-container">
        <div *ngFor="let day of itinerary; let dayIndex = index" class="day-section">
          <h3 class="day-title">Day {{ day.day }}</h3>
          <div *ngFor="let spot of sortByTimeSlot(day.spots); let i = index" class="spot-item">
            <div class="spot-name">{{ i + 1 }}. {{ spot.name }}</div>
            <div class="spot-details">
              <span class="time">⏰ {{ spot.timeSlot }}</span>
              <span class="duration">⏱️ {{ spot.estimatedDuration }}</span>
            </div>
            <div class="spot-category">📍 {{ spot.category }}</div>
            
            <!-- Show Suggestions Button for spots with meal times -->
            <div *ngIf="spot.mealType && !spot.chosenRestaurant" class="suggestions-toggle">
              <div class="suggestion-buttons">
                <ion-button *ngIf="spot.restaurantSuggestions?.length > 0" size="small" fill="outline" color="warning" (click)="toggleSuggestions(getSpotKey(dayIndex, i))">
                  <ion-icon name="restaurant-outline"></ion-icon>
                  {{ areSuggestionsVisible(getSpotKey(dayIndex, i)) ? 'Hide' : 'Show' }} Restaurant Options
                </ion-button>
                <ion-button *ngIf="!spot.restaurantSuggestions || spot.restaurantSuggestions.length === 0" size="small" fill="outline" color="medium" disabled>
                  <ion-icon name="restaurant-outline"></ion-icon>
                  No Options Available
                </ion-button>
                <ion-button size="small" fill="clear" color="medium" (click)="skipRestaurant(spot)">
                  <ion-icon name="close-circle-outline"></ion-icon>
                  Skip for now
                </ion-button>
              </div>
            </div>
            
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
            <div *ngIf="spot.mealType && !spot.chosenRestaurant && spot.restaurantSuggestions && spot.restaurantSuggestions.length > 0 && areSuggestionsVisible(getSpotKey(dayIndex, i))" class="suggestions-section">
              <div class="suggestions-header">
                <ion-icon name="restaurant-outline" color="warning"></ion-icon>
                <span>Restaurant Options ({{ spot.mealType }})</span>
              </div>
              <div class="suggestions-grid">
                <div *ngFor="let rest of (spot.restaurantSuggestions || []) | slice:0:3; trackBy: trackByPlaceId" class="suggestion-card">
                  <div class="suggestion-name">{{ getPlaceName(rest) }}</div>
                  <div class="suggestion-details">
                    <span *ngIf="getPlaceRating(rest)">⭐ {{ getPlaceRating(rest) }}★</span>
                    <span *ngIf="getPlaceVicinity(rest)">📍 {{ getPlaceVicinity(rest) }}</span>
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
            </div>

          </div>
          
          <!-- Show Hotel Suggestions Button -->
          <div *ngIf="day.spots.length > 0 && !day.chosenHotel" class="suggestions-toggle hotel-toggle">
            <div class="suggestion-buttons">
              <ion-button *ngIf="day.hotelSuggestions && day.hotelSuggestions.length > 0" size="small" fill="outline" color="primary" (click)="toggleSuggestions(getDayKey(dayIndex))">
                <ion-icon name="bed-outline"></ion-icon>
                {{ areSuggestionsVisible(getDayKey(dayIndex)) ? 'Hide' : 'Show' }} Hotel Options
              </ion-button>
              <ion-button *ngIf="!day.hotelSuggestions || day.hotelSuggestions.length === 0" size="small" fill="outline" color="medium" disabled>
                <ion-icon name="bed-outline"></ion-icon>
                No Options Available
              </ion-button>
              <ion-button size="small" fill="clear" color="medium" (click)="skipHotel(day)">
                <ion-icon name="close-circle-outline"></ion-icon>
                Skip for now
              </ion-button>
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
          <div *ngIf="!day.chosenHotel && day.hotelSuggestions && day.hotelSuggestions.length > 0 && areSuggestionsVisible(getDayKey(dayIndex))" class="suggestions-section">
            <div class="suggestions-header">
              <ion-icon name="bed-outline" color="primary"></ion-icon>
              <span>Hotel Options (End of Day)</span>
            </div>
            <div class="suggestions-grid">
              <div *ngFor="let hotel of (day.hotelSuggestions || []) | slice:0:3; trackBy: trackByPlaceId" class="suggestion-card">
                <div class="suggestion-name">{{ getPlaceName(hotel) }}</div>
                <div class="suggestion-details">
                  <span *ngIf="getPlaceRating(hotel)">⭐ {{ getPlaceRating(hotel) }}★</span>
                  <span *ngIf="getPlaceVicinity(hotel)">📍 {{ getPlaceVicinity(hotel) }}</span>
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
          </div>

        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" color="success" (click)="saveItinerary()" [disabled]="saving">
          <ion-spinner *ngIf="saving" name="crescent"></ion-spinner>
                          <span *ngIf="!saving">Save Itinerary</span>
        </ion-button>
        <ion-button expand="block" color="secondary" (click)="viewMap()">
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
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .day-date {
      color: #666;
      font-size: 0.9rem;
      font-weight: 500;
      background: rgba(231, 76, 60, 0.1);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(231, 76, 60, 0.2);
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
      overflow-x: auto;
      max-width: 100%;
      box-sizing: border-box;
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
      max-width: 100%;
      box-sizing: border-box;
    }

    .suggestion-card {
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #dee2e6;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
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
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
    }

    .suggestion-actions ion-button {
      flex: 1 1 40%;
      min-width: 90px;
      max-width: 100%;
      font-size: 0.9rem;
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

    /* Route Information Styles */
    .route-chain {
      margin-top: 12px;
    }

    .jeepney-route-info {
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 4px solid;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .route-user-to-spot {
      border-left-color: #28a745;
      background: linear-gradient(135deg, #f8fff9, #ffffff);
    }

    .route-spot-to-restaurant {
      border-left-color: #ffc107;
      background: linear-gradient(135deg, #fffbf0, #ffffff);
    }

    .route-restaurant-to-spot {
      border-left-color: #007bff;
      background: linear-gradient(135deg, #f0f8ff, #ffffff);
    }

    .route-spot-to-spot {
      border-left-color: #007bff;
      background: linear-gradient(135deg, #f0f8ff, #ffffff);
    }

    .route-spot-to-hotel {
      border-left-color: #6c757d;
      background: linear-gradient(135deg, #f8f9fa, #ffffff);
    }

    .route-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .route-title {
      font-weight: 600;
      color: #2D3748;
      font-size: 0.9rem;
    }

    .route-details {
      font-size: 0.85rem;
    }

    .route-code {
      color: #e74c3c;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .route-time {
      color: #28a745;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .route-direction {
      color: #495057;
      margin-bottom: 6px;
      line-height: 1.3;
    }

    .route-description {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: #6c757d;
      font-size: 0.8rem;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .meal-info {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #ffc107;
      font-weight: 500;
      font-size: 0.8rem;
      margin-top: 4px;
    }

    .google-directions-info {
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      border: 1px solid #e9ecef;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .route-steps {
      margin-top: 8px;
    }

    .direction-step {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid #f8f9fa;
    }

    .direction-step:last-child {
      border-bottom: none;
    }

    .direction-step ion-icon {
      margin-top: 2px;
      flex-shrink: 0;
    }

    .direction-step span {
      flex: 1;
      font-size: 0.85rem;
      line-height: 1.3;
    }

    .step-details {
      margin-top: 2px;
      color: #6c757d;
      font-size: 0.75rem;
    }

    .no-local-route, .no-google-directions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #6c757d;
      font-size: 0.85rem;
      text-align: center;
    }

    .no-local-route ion-icon, .no-google-directions ion-icon {
      font-size: 2rem;
      opacity: 0.5;
    }

    /* Suggestion Toggle Buttons */
    .suggestions-toggle {
      margin: 12px 0;
      text-align: center;
    }

    .suggestions-toggle.hotel-toggle {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #dee2e6;
    }

    .suggestions-toggle ion-button {
      font-size: 0.9rem;
      --padding-start: 12px;
      --padding-end: 12px;
    }

    .suggestion-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
    }

    .suggestion-buttons ion-button {
      flex: 1;
      min-width: 120px;
    }

    /* Loading suggestions indicator */
    .loading-suggestions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px;
      background: #f8f9fa;
      margin: 16px;
      border-radius: 12px;
      border: 1px solid #dee2e6;
    }

    .loading-suggestions span {
      color: #6c757d;
      font-size: 0.9rem;
      font-weight: 500;
    }
  `],
  standalone: false
})
export class ItineraryModalComponent implements OnInit {
  @Input() itinerary: ItineraryDay[] = [];
  @Input() originalStartTime: string = '';
  @Input() originalEndTime: string = '';
  @Input() originalSpots: any[] = [];

  // Store original dates to clear them when editing
  private originalDates: string[] = [];

  fetchingSuggestions = false;
  saving = false;
  suggestionsVisible: { [key: string]: boolean } = {}; // Track which spots show suggestions


  constructor(
    private modalCtrl: ModalController, 
    private itineraryService: ItineraryService, 
    private cdr: ChangeDetectorRef,
    private calendarService: CalendarService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    // Auto-fetch suggestions when modal opens
    await this.autoFetchSuggestions();
  }

  private async autoFetchSuggestions() {
    try {
      this.fetchingSuggestions = true;
      this.itinerary = await this.itineraryService.fetchSuggestionsForItinerary(this.itinerary);
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error auto-fetching suggestions:', error);
    } finally {
      this.fetchingSuggestions = false;
    }
  }

  // Toggle suggestion visibility for a specific spot
  toggleSuggestions(spotKey: string) {
    this.suggestionsVisible[spotKey] = !this.suggestionsVisible[spotKey];
  }

  // Check if suggestions should be visible for a spot
  areSuggestionsVisible(spotKey: string): boolean {
    return !!this.suggestionsVisible[spotKey];
  }

  // Generate unique key for spot
  getSpotKey(dayIndex: number, spotIndex: number): string {
    return `day${dayIndex}_spot${spotIndex}`;
  }

  // Generate unique key for day (hotel suggestions)
  getDayKey(dayIndex: number): string {
    return `day${dayIndex}_hotel`;
  }

  sortByTimeSlot(items: any[]): any[] {
    if (!items || items.length === 0) {
      return items;
    }

    return items.sort((a, b) => {
      const timeA = a.timeSlot || '00:00';
      const timeB = b.timeSlot || '00:00';
      
      // Convert time strings to comparable values
      const [hoursA, minutesA] = timeA.split(':').map(Number);
      const [hoursB, minutesB] = timeB.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB; // Ascending order (earliest first)
    });
  }

  trackByPlaceId(index: number, item: any): string {
    return (item as PlaceSuggestion).place_id || index.toString();
  }

  getPlaceName(place: any): string {
    return (place as PlaceSuggestion)?.name || 'Unknown Place';
  }

  getPlaceRating(place: any): number | null {
    return (place as PlaceSuggestion)?.rating || null;
  }

  getPlaceVicinity(place: any): string | null {
    return (place as PlaceSuggestion)?.vicinity || null;
  }

  async saveItinerary() {
    const validation = this.validateItineraryChoices();
    if (!validation.isValid) {
      this.showAlert('Incomplete Itinerary', validation.message);
      return;
    }

    this.saving = true;
    
    try {
      // Generate complete route information for each day
      for (const day of this.itinerary) {
        await this.itineraryService.generateCompleteRouteInfo(day);
      }
      
      // Save to calendar
      await this.saveItineraryToCalendar();
      
      this.showAlert('Success', 'Itinerary saved successfully! Your complete route information has been generated.');
      this.modalCtrl.dismiss({ saved: true });
      
    } catch (error) {
      console.error('Error saving itinerary:', error);
      this.showAlert('Error', 'Failed to save itinerary. Please try again.');
    } finally {
      this.saving = false;
    }
  }

  private validateItineraryChoices(): { isValid: boolean; message: string } {
    for (const day of this.itinerary) {
      // Check restaurant choices for each spot
      for (const spot of day.spots) {
        if (spot.mealType && !spot.chosenRestaurant) {
          return {
            isValid: false,
            message: `Please select a restaurant or skip for ${spot.name} (${spot.mealType} time)`
          };
        }
      }
      
      // Check hotel choice for the day
      if (day.spots.length > 0 && !day.chosenHotel) {
        return {
          isValid: false,
          message: `Please select a hotel or skip for Day ${day.day}`
        };
      }
    }
    
    return { isValid: true, message: '' };
  }

  private async saveItineraryToCalendar() {
    // Get the dates for this itinerary
    const itineraryDates = this.itinerary.map(day => day.date).filter((date): date is string => date !== undefined);
    
    // Clear events for both original dates and new dates to prevent duplication
    const datesToClear = [...new Set([...this.originalDates, ...itineraryDates])];
    await this.calendarService.clearEventsForDates(datesToClear);
    
    // Convert itinerary to calendar events
    const events: CalendarEvent[] = [];
    
    for (const day of this.itinerary) {
      if (!day.date) {
        throw new Error('Itinerary days must have dates assigned');
      }
      
      // Add spots as events
      for (const spot of day.spots) {
        const startTime = `${day.date}T${spot.timeSlot}:00`;
        const event: CalendarEvent = {
          title: spot.name,
          start: startTime,
          end: startTime, // You can calculate end time based on duration
          color: '#28a745', // Green for user events
          textColor: '#fff',
          allDay: false,
          extendedProps: {
            type: 'tourist_spot',
            description: spot.description || '',
            category: spot.category || 'GENERAL',
            duration: spot.estimatedDuration || '2 hours',
            restaurant: spot.chosenRestaurant?.name || null,
            restaurantRating: spot.chosenRestaurant?.rating || null,
            restaurantVicinity: spot.chosenRestaurant?.vicinity || null,
            mealType: spot.mealType || null,

            originalStartTime: this.originalStartTime,
            originalEndTime: this.originalEndTime
          }
        };
        events.push(event);

        // Add restaurant as separate event if chosen
        if (spot.chosenRestaurant && spot.chosenRestaurant.name !== 'User will decide on the day') {
          // Calculate restaurant time based on meal type and spot time
          const spotStartTime = new Date(startTime);
          let restaurantTime: Date;
          
          // Determine meal time based on spot time and meal type
          const spotHour = spotStartTime.getHours();
          const mealType = spot.mealType?.toLowerCase() || '';
          
          if (mealType.includes('breakfast') || spotHour < 10) {
            // Breakfast - schedule 30 minutes after spot starts
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else if (mealType.includes('lunch') || (spotHour >= 10 && spotHour < 14)) {
            // Lunch - schedule 30 minutes after spot starts
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else if (mealType.includes('dinner') || spotHour >= 14) {
            // Dinner - schedule 30 minutes after spot starts
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else {
            // Default - schedule 30 minutes after spot starts
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          }
          
          // Format restaurant time manually to avoid timezone issues
          const year = restaurantTime.getFullYear();
          const month = String(restaurantTime.getMonth() + 1).padStart(2, '0');
          const day = String(restaurantTime.getDate()).padStart(2, '0');
          const hours = String(restaurantTime.getHours()).padStart(2, '0');
          const minutes = String(restaurantTime.getMinutes()).padStart(2, '0');
          const restaurantStartTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;
          
          const restaurantEvent: CalendarEvent = {
            title: `🍽️ ${spot.chosenRestaurant.name}`,
            start: restaurantStartTime,
            end: restaurantStartTime,
            color: '#ff9800', // Orange for restaurants
            textColor: '#fff',
            allDay: false,
            extendedProps: {
              type: 'restaurant',
              description: `${spot.mealType} at ${spot.chosenRestaurant.name}`,
              restaurant: spot.chosenRestaurant.name || '',
              vicinity: spot.chosenRestaurant.vicinity || '',
              rating: spot.chosenRestaurant.rating || null,
              mealType: spot.mealType || '',
              isChosen: true,
              isItineraryEvent: true
            }
          };
          
          // Add location coordinates if available
          if (spot.chosenRestaurant.location && spot.chosenRestaurant.location.lat && spot.chosenRestaurant.location.lng) {
            restaurantEvent.extendedProps.location = spot.chosenRestaurant.location;
          }
          events.push(restaurantEvent);
        }
      }
      
      // Add hotel as event if chosen
      if (day.chosenHotel) {
        const hotelStartTime = `${day.date}T18:00:00`;
        const hotelEvent: CalendarEvent = {
          title: `🏨 ${day.chosenHotel.name}`,
          start: hotelStartTime,
          end: hotelStartTime,
          color: '#3880ff', // Blue for hotels
          textColor: '#fff',
          allDay: false,
          extendedProps: {
            type: 'hotel',
            description: 'Hotel check-in',
            hotel: day.chosenHotel.name || '',
            vicinity: day.chosenHotel.vicinity || '',
            rating: day.chosenHotel.rating || null,
            isChosen: true,
            isItineraryEvent: true
          }
        };
        
        // Add location coordinates if available
        if (day.chosenHotel.location && day.chosenHotel.location.lat && day.chosenHotel.location.lng) {
          hotelEvent.extendedProps.location = day.chosenHotel.location;
        }
        events.push(hotelEvent);

      }
    }
    
    
    
    // Save using the calendar service
    await this.calendarService.saveItineraryEvents(events);
    
  }


  chooseRestaurant(spot: ItinerarySpot, restaurant: any) {
    // Ensure restaurant has lat/lng coordinates for pin utilization
    if (restaurant.geometry && restaurant.geometry.location) {
      spot.chosenRestaurant = {
        ...restaurant,
        location: {
          lat: restaurant.geometry.location.lat,
          lng: restaurant.geometry.location.lng
        }
      };
    } else {
      spot.chosenRestaurant = restaurant;
    }
  }
  
  skipRestaurant(spot: ItinerarySpot) {
    spot.chosenRestaurant = { name: 'User will decide on the day' };
  }
  
  clearRestaurantChoice(spot: ItinerarySpot) {
    spot.chosenRestaurant = undefined;
  }

  chooseHotel(day: ItineraryDay, hotel: any) {
    // Ensure hotel has lat/lng coordinates for pin utilization
    if (hotel.geometry && hotel.geometry.location) {
      day.chosenHotel = {
        ...hotel,
        location: {
          lat: hotel.geometry.location.lat,
          lng: hotel.geometry.location.lng
        }
      };
    } else {
      day.chosenHotel = hotel;
    }
  }
  
  skipHotel(day: ItineraryDay) {
    day.chosenHotel = { name: 'User will decide on the day' };
  }
  
  clearHotelChoice(day: ItineraryDay) {
    day.chosenHotel = undefined;
  }

  async editItinerary() {
    // Store the original dates before editing
    this.originalDates = this.itinerary.map(day => day.date).filter((date): date is string => date !== undefined);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryEditorComponent,
      componentProps: {
        itinerary: this.itinerary,
        availableSpots: this.originalSpots // Use the original bucket list spots
      },
      cssClass: 'itinerary-editor-modal'
    });
    modal.onDidDismiss().then(async result => {
      if (result.data) {
        // Update the itinerary with the edited data
        this.itinerary = result.data;
        
        // Force change detection to update the UI immediately
        this.cdr.detectChanges();
        
        // Show message to remind user to save
        this.showAlert('Itinerary Updated', 'Your itinerary has been updated! Click "Save Itinerary" to save your changes to the calendar.');
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
    // Create a simple toast-like alert
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${header === 'Success' ? '#4caf50' : '#f44336'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      text-align: center;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(alertDiv)) {
        document.body.removeChild(alertDiv);
      }
    }, 3000);
  }


  private getItineraryId(): string {
    // Generate a unique ID for this itinerary based on the spots
    if (this.itinerary && this.itinerary.length > 0) {
      const spotNames = this.itinerary
        .map((day: any) => day.spots.map((spot: any) => spot.name))
        .reduce((acc, spots) => acc.concat(spots), [])
        .join('_');
      return `itinerary_${spotNames.substring(0, 50).replace(/\s+/g, '_')}`;
    }
    return `itinerary_${Date.now()}`;
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

} 
