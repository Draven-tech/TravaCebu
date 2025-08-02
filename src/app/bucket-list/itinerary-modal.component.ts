import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ItineraryEditorComponent } from './itinerary-editor.component';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';
import { ChangeDetectorRef } from '@angular/core';
import { ItineraryMapComponent } from './itinerary-map.component';
import { CalendarService, CalendarEvent } from '../services/calendar.service';

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
            
            <!-- Transportation Options -->
            <div class="transport-section">
              <ion-segment [(ngModel)]="transportTabs[day.day + '-' + i]" mode="ios" color="warning">
                <ion-segment-button value="local">
                  <ion-label>🚌 Local Routes</ion-label>
                </ion-segment-button>
                <ion-segment-button value="google">
                  <ion-label>🗺️ Google Directions</ion-label>
                </ion-segment-button>
              </ion-segment>

              <!-- Local Jeepney Routes Tab -->
              <div *ngIf="transportTabs[day.day + '-' + i] === 'local'">
                <div *ngIf="getRouteChain(day, i).length > 0" class="route-chain">
                  <div *ngFor="let route of getRouteChain(day, i)" class="jeepney-route-info" [ngClass]="getRouteClass(route.type)">
                    <div class="route-header">
                      <ion-icon [name]="getRouteIcon(route.type)" [color]="getRouteColor(route.type)"></ion-icon>
                      <span class="route-title">{{ getRouteTitle(route.type) }}</span>
                    </div>
                    <div class="route-details">
                      <div class="route-code">🚌 Code: <strong>{{ route.jeepneyCode }}</strong></div>
                      <div class="route-time">⏱️ {{ route.estimatedTime }}</div>
                      <div class="route-direction">
                        From: <strong>{{ route.from }}</strong> → To: <strong>{{ route.to }}</strong>
                      </div>
                      <div class="route-note">
                        <ion-icon name="information-circle-outline" color="primary"></ion-icon>
                        <span>{{ getRouteDescription(route.type) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div *ngIf="getRouteChain(day, i).length === 0" class="no-local-route">
                  <ion-icon name="car-outline" color="medium"></ion-icon>
                  <span>No local jeepney routes found. Try Google Directions tab.</span>
                </div>
              </div>

              <!-- Google Directions Tab -->
              <div *ngIf="transportTabs[day.day + '-' + i] === 'google'">
                <div *ngIf="getGoogleDirections(day, i)" class="google-directions-info">
                  <div class="route-header">
                    <ion-icon name="map-outline" color="primary"></ion-icon>
                    <span class="route-title">Google Directions</span>
                  </div>
                  <div class="route-details">
                    <div class="route-time">⏱️ {{ getGoogleDirections(day, i).duration }}</div>
                    <div class="route-distance">📏 {{ getGoogleDirections(day, i).distance }}</div>
                    <div class="route-steps">
                      <div *ngFor="let step of getGoogleDirections(day, i).steps" class="direction-step">
                        <ion-icon [name]="getTransportIcon(step.mode)" [color]="getTransportColor(step.mode)"></ion-icon>
                        <span>{{ step.instruction }}</span>
                      </div>
                    </div>
                    <div class="route-note">
                      <ion-icon name="information-circle-outline" color="primary"></ion-icon>
                      <span>Real-time directions from Google</span>
                    </div>
                  </div>
                </div>
                <div *ngIf="!getGoogleDirections(day, i)" class="no-google-directions">
                  <ion-icon name="map-outline" color="medium"></ion-icon>
                  <span>Click "Fetch Directions" to get Google directions.</span>
                  <ion-button size="small" fill="outline" color="primary" (click)="fetchGoogleDirections(day, i)">
                    <ion-icon name="refresh"></ion-icon> Fetch Directions
                  </ion-button>
                </div>
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
              <span>Click "Fetch Suggestions" to get restaurant options for {{ spot.mealType }} time.</span>
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
            <span>Click "Fetch Suggestions" to get hotel options for Day {{ day.day }}.</span>
          </div>
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" color="success" (click)="saveItinerary()" [disabled]="saving">
          <ion-spinner *ngIf="saving" name="crescent"></ion-spinner>
          <span *ngIf="!saving">Save to Calendar</span>
        </ion-button>
        <ion-button expand="block" color="primary" (click)="fetchSuggestions()" [disabled]="fetchingSuggestions">
          <ion-spinner *ngIf="fetchingSuggestions" name="crescent"></ion-spinner>
          <span *ngIf="!fetchingSuggestions">Fetch Suggestions</span>
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
  `],
  standalone: false
})
export class ItineraryModalComponent {
  @Input() itinerary: ItineraryDay[] = [];
  fetchingSuggestions = false;
  saving = false;
  transportTabs: { [key: string]: string } = {};
  googleDirections: { [key: string]: any } = {};
  fetchingDirections: { [key: string]: boolean } = {};

  constructor(
    private modalCtrl: ModalController, 
    private itineraryService: ItineraryService, 
    private cdr: ChangeDetectorRef,
    private calendarService: CalendarService
  ) {}

  async saveItinerary() {
    // Validate that all restaurants and hotels are either chosen or skipped
    const validationResult = this.validateItineraryChoices();
    if (!validationResult.isValid) {
      this.showAlert('Incomplete Choices', validationResult.message);
      return;
    }

    this.saving = true;
    
    try {
      // Save itinerary to calendar/calendar service
      await this.saveItineraryToCalendar();
      
      // Show success message
      this.showAlert('Success', 'Itinerary saved to calendar! You can now view it in the calendar page.');
      
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
    // Convert itinerary to calendar events
    const events: CalendarEvent[] = [];
    
    console.log('Saving itinerary to calendar:', this.itinerary);
    
    for (const day of this.itinerary) {
      if (!day.date) {
        throw new Error('Itinerary days must have dates assigned');
      }
      
      console.log(`Processing Day ${day.day} with date: ${day.date}`);
      
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
            description: spot.description,
            category: spot.category,
            duration: spot.estimatedDuration,
            restaurant: spot.chosenRestaurant?.name,
            mealType: spot.mealType,
            jeepneyRoute: this.getJeepneyRoute(day, day.spots.indexOf(spot)),
            googleDirections: this.getGoogleDirections(day, day.spots.indexOf(spot))
          }
        };
        events.push(event);
        console.log(`Added event: ${spot.name} at ${startTime}`);
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
            hotel: day.chosenHotel.name,
            vicinity: day.chosenHotel.vicinity
          }
        };
        events.push(hotelEvent);
        console.log(`Added hotel event: ${day.chosenHotel.name} at ${hotelStartTime}`);
      }
    }
    
    console.log('Total events to save:', events.length);
    console.log('Events:', events);
    
    // Save using the calendar service
    await this.calendarService.saveItineraryEvents(events);
    
    console.log('Events saved successfully!');
  }

  async fetchSuggestions() {
    this.fetchingSuggestions = true;
    
    try {
      this.itinerary = await this.itineraryService.fetchSuggestionsForItinerary(this.itinerary, (msg: string) => {
        // console.log(msg); // Removed debug logging
      });
      this.cdr.detectChanges();
      
      // Show success message
      this.showAlert('Success', 'Restaurant and hotel suggestions updated!');
      
    } catch (error) {
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
    // Store original itinerary for comparison
    const originalItinerary = JSON.stringify(this.itinerary);
    
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
        const newItinerary = JSON.stringify(result.data);
        this.itinerary = result.data;
        
        // Only auto-refresh if the itinerary actually changed
        if (originalItinerary !== newItinerary) {
          this.fetchSuggestions();
        }
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
        
        // Add transportation information
        const jeepneyRoute = this.getJeepneyRoute(day, index);
        const googleDirections = this.getGoogleDirections(day, index);
        
        if (jeepneyRoute) {
          notes += `   🚌 Local Jeepney: Code ${jeepneyRoute.jeepneyCode} (${jeepneyRoute.estimatedTime})\n`;
          notes += `   Route: ${jeepneyRoute.from} → ${jeepneyRoute.to}\n`;
        }
        
        if (googleDirections) {
          notes += `   🗺️ Google Directions: ${googleDirections.duration} (${googleDirections.distance})\n`;
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

  // Get jeepney route for a specific spot (legacy method)
  getJeepneyRoute(day: ItineraryDay, spotIndex: number): any {
    if (spotIndex === 0) return null; // First spot has no previous route
    return day.routes[spotIndex - 1] || null;
  }

  // Get route chain for a specific spot
  getRouteChain(day: ItineraryDay, spotIndex: number): any[] {
    // Return all routes that involve this spot
    return day.routes.filter(route => {
      const spotName = day.spots[spotIndex].name;
      return route.from === spotName || route.to === spotName;
    });
  }

  // Get Google directions for a specific spot
  getGoogleDirections(day: ItineraryDay, spotIndex: number): any {
    if (spotIndex === 0) return null; // First spot has no previous route
    const key = `${day.day}-${spotIndex}`;
    return this.googleDirections[key] || null;
  }

  // Fetch Google directions for a specific route
  async fetchGoogleDirections(day: ItineraryDay, spotIndex: number) {
    if (spotIndex === 0) return; // First spot has no previous route
    
    const key = `${day.day}-${spotIndex}`;
    this.fetchingDirections[key] = true;
    
    try {
      const prevSpot = day.spots[spotIndex - 1];
      const currentSpot = day.spots[spotIndex];
      
      const directions = await this.itineraryService.getDirectionsRoute(prevSpot, currentSpot);
      
      if (directions.type === 'transit' && directions.details) {
        this.googleDirections[key] = {
          duration: this.calculateTotalDuration(directions.details),
          distance: this.calculateTotalDistance(directions.details),
          steps: this.formatDirectionSteps(directions.details)
        };
      } else {
        this.googleDirections[key] = {
          duration: 'Route not available',
          distance: 'N/A',
          steps: [{ mode: 'walk', instruction: 'No public transport route found' }]
        };
      }
      
      this.cdr.detectChanges();
      
    } catch (error) {
      console.error('Error fetching Google directions:', error);
      this.showAlert('Error', 'Failed to fetch directions. Please try again.');
    } finally {
      this.fetchingDirections[key] = false;
    }
  }

  // Calculate total duration from direction steps
  private calculateTotalDuration(steps: any[]): string {
    if (!steps || steps.length === 0) return 'Unknown';
    
    // Estimate duration based on number of steps
    const estimatedMinutes = steps.length * 5; // Rough estimate: 5 min per step
    return `${Math.max(10, estimatedMinutes)} min`;
  }

  // Calculate total distance from direction steps
  private calculateTotalDistance(steps: any[]): string {
    if (!steps || steps.length === 0) return 'Unknown';
    
    // Estimate distance based on number of steps
    const estimatedKm = steps.length * 0.5; // Rough estimate: 0.5 km per step
    return `${Math.max(1, estimatedKm).toFixed(1)} km`;
  }

  // Format direction steps for display
  private formatDirectionSteps(steps: any[]): any[] {
    return steps.map(step => ({
      mode: step.vehicle || 'walk',
      instruction: step.instructions || 'Continue on route'
    }));
  }

  // Get transport icon based on mode
  getTransportIcon(mode: string): string {
    switch (mode.toLowerCase()) {
      case 'bus': return 'bus-outline';
      case 'train': return 'train-outline';
      case 'subway': return 'subway-outline';
      case 'walk': return 'walk-outline';
      default: return 'car-outline';
    }
  }

  // Get transport color based on mode
  getTransportColor(mode: string): string {
    switch (mode.toLowerCase()) {
      case 'bus': return 'warning';
      case 'train': return 'primary';
      case 'subway': return 'secondary';
      case 'walk': return 'success';
      default: return 'medium';
    }
  }

  // Initialize transport tabs when itinerary is set
  ngOnInit() {
    this.initializeTransportTabs();
  }

  private initializeTransportTabs() {
    this.transportTabs = {};
    this.googleDirections = {};
    this.fetchingDirections = {};
    
    // Set default tab to 'local' for all routes
    this.itinerary.forEach(day => {
      day.spots.forEach((spot, index) => {
        const key = `${day.day}-${index}`;
        this.transportTabs[key] = 'local';
      });
    });
  }

  // Route display helper methods
  getRouteIcon(type: string): string {
    switch (type) {
      case 'user_to_spot': return 'navigate-outline';
      case 'spot_to_restaurant': return 'restaurant-outline';
      case 'restaurant_to_spot': return 'car-outline';
      case 'spot_to_spot': return 'car-outline';
      case 'spot_to_hotel': return 'bed-outline';
      default: return 'car-outline';
    }
  }

  getRouteColor(type: string): string {
    switch (type) {
      case 'user_to_spot': return 'success';
      case 'spot_to_restaurant': return 'warning';
      case 'restaurant_to_spot': return 'primary';
      case 'spot_to_spot': return 'warning';
      case 'spot_to_hotel': return 'primary';
      default: return 'warning';
    }
  }

  getRouteTitle(type: string): string {
    switch (type) {
      case 'user_to_spot': return 'From Your Location';
      case 'spot_to_restaurant': return 'To Restaurant';
      case 'restaurant_to_spot': return 'From Restaurant';
      case 'spot_to_spot': return 'To Next Spot';
      case 'spot_to_hotel': return 'To Hotel';
      default: return 'Jeepney Route';
    }
  }

  getRouteDescription(type: string): string {
    switch (type) {
      case 'user_to_spot': return 'Route from your current location';
      case 'spot_to_restaurant': return 'Route to your chosen restaurant';
      case 'restaurant_to_spot': return 'Route from restaurant to next destination';
      case 'spot_to_spot': return 'Direct route to next tourist spot';
      case 'spot_to_hotel': return 'Route to your hotel for the night';
      default: return 'Curated local route from our database';
    }
  }

  getRouteClass(type: string): string {
    switch (type) {
      case 'user_to_spot': return 'route-user-location';
      case 'spot_to_restaurant': return 'route-restaurant';
      case 'restaurant_to_spot': return 'route-restaurant-return';
      case 'spot_to_spot': return 'route-spot-to-spot';
      case 'spot_to_hotel': return 'route-hotel';
      default: return '';
    }
  }
} 
