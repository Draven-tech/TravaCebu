import { Component, Input, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as L from 'leaflet';
import { ItineraryDay, ItineraryService } from '../services/itinerary.service';
import { DaySpotPickerComponent } from '../user-map/day-spot-picker.component';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-itinerary-map',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Itinerary Map</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="map-container">
        <div #mapElement id="itinerary-map"></div>
        
        <div *ngIf="!mapLoaded" class="map-loading">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading map...</p>
        </div>
        
        <div class="map-controls" *ngIf="mapLoaded">
          <ion-button size="small" (click)="toggleMapType()" [color]="useEsri ? 'primary' : 'secondary'">
            <ion-icon name="map"></ion-icon>
            {{ useEsri ? 'Satellite' : 'OSM' }}
          </ion-button>
          <ion-button size="small" (click)="toggleHotels()" [color]="showHotels ? 'success' : 'medium'">
            <ion-icon name="bed"></ion-icon>
            {{ showHotels ? 'Hide' : 'Show' }} Hotels
          </ion-button>
          <ion-button size="small" (click)="toggleRestaurants()" [color]="showRestaurants ? 'success' : 'medium'">
            <ion-icon name="restaurant"></ion-icon>
            {{ showRestaurants ? 'Hide' : 'Show' }} Restaurants
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .map-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    #itinerary-map {
      height: 100% !important;
      min-height: 100% !important;
      width: 100% !important;
      min-width: 100% !important;
      touch-action: auto !important;
      pointer-events: auto !important;
      z-index: 1;
      position: absolute;
      top: 0;
      left: 0;
    }
    
    .map-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .map-controls ion-button {
      --padding-start: 8px;
      --padding-end: 8px;
      font-size: 12px;
    }
    
    .map-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 10px;
      z-index: 1000;
    }
    
    .map-loading p {
      margin: 10px 0 0 0;
      color: #666;
    }
    
    /* Map modal styles */
    :global(.map-modal) {
      --height: 90%;
      --width: 90%;
      --max-width: 800px;
    }
    
    /* Custom marker styles */
    :global(.custom-marker) {
      background: transparent !important;
      border: none !important;
      transition: transform 0.2s ease-in-out;
    }
    
    :global(.custom-marker:hover) {
      transform: scale(1.1);
    }
    
    :global(.hotel-marker) {
      background: transparent !important;
      border: none !important;
      transition: transform 0.2s ease-in-out;
    }
    
    :global(.hotel-marker:hover) {
      transform: scale(1.1);
    }
    
    :global(.restaurant-marker) {
      background: transparent !important;
      border: none !important;
      transition: transform 0.2s ease-in-out;
    }
    
    :global(.restaurant-marker:hover) {
      transform: scale(1.1);
    }

    /* Highlight marker animation */
    @keyframes pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 4px 12px rgba(255,215,0,0.6);
      }
      50% {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(255,215,0,0.8);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 4px 12px rgba(255,215,0,0.6);
      }
    }

    :global(.highlight-marker) {
      background: transparent !important;
      border: none !important;
    }
  `],
  standalone: false
})
export class ItineraryMapComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() itinerary: ItineraryDay[] = [];
  @Input() highlightPlace: any = null; // For highlighting specific restaurant/hotel
  
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private popups: L.Popup[] = [];
  private highlightMarker?: L.Marker;
  showHotels = true;
  showRestaurants = true;
  mapLoaded = false;
  useEsri = false; // Toggle between Esri Satellite and OpenStreetMap

  constructor(
    private modalCtrl: ModalController, 
    private ngZone: NgZone,
    private itineraryService: ItineraryService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    // Component initialized
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 500);
    }, 200);

    // Add global functions for popup buttons
    (window as any).addRestaurantToItinerary = (placeId: string, restaurantData: string) => {
      console.log('addRestaurantToItinerary called with:', placeId, restaurantData);
      try {
        const restaurant = JSON.parse(restaurantData);
        console.log('Parsed restaurant data:', restaurant);
        this.ngZone.run(() => {
          this.addToItinerary(restaurant, 'restaurant');
        });
      } catch (error) {
        console.error('Error parsing restaurant data:', error);
        console.error('Raw restaurant data:', restaurantData);
      }
    };

    (window as any).addHotelToItinerary = (placeId: string, hotelData: string) => {
      console.log('addHotelToItinerary called with:', placeId, hotelData);
      try {
        const hotel = JSON.parse(hotelData);
        console.log('Parsed hotel data:', hotel);
        this.ngZone.run(() => {
          this.addToItinerary(hotel, 'hotel');
        });
      } catch (error) {
        console.error('Error parsing hotel data:', error);
        console.error('Raw hotel data:', hotelData);
      }
    };
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
    
    // Clean up global functions
    delete (window as any).addRestaurantToItinerary;
    delete (window as any).addHotelToItinerary;
  }

  private initMap() {
    if (!this.itinerary || this.itinerary.length === 0) {
      console.log('No itinerary data to display');
      return;
    }

    // Get center point from first tourist spot
    const firstSpot = this.itinerary[0]?.spots[0];
    if (!firstSpot) {
      console.log('No spots found in itinerary');
      return;
    }

    if (this.map) {
      this.map.remove();
    }

    try {
      this.map = L.map('itinerary-map', {
        center: [firstSpot.location.lat, firstSpot.location.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true
      });

      // Add tile layer based on selection
      if (this.useEsri) {
        // Esri Satellite tiles
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Satellite Imagery © Esri',
          maxZoom: 19
        }).addTo(this.map);
      } else {
        // OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(this.map);
      }

      this.addTouristSpots();
      this.addHotelMarkers();
      this.addRestaurantMarkers();
      
      // Add highlight marker if specified
      if (this.highlightPlace && this.highlightPlace.geometry && this.highlightPlace.geometry.location) {
        this.addHighlightMarker();
      }
      
      this.mapLoaded = true;

      setTimeout(() => {
        this.map.invalidateSize();
      }, 300);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private addTouristSpots() {
    this.itinerary.forEach((day, dayIndex) => {
      day.spots.forEach((spot, spotIndex) => {
        // Create custom icon for tourist spots
        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">${day.day}.${spotIndex + 1}</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const marker = L.marker([spot.location.lat, spot.location.lng], {
          icon: customIcon,
          title: `${spot.name} (Day ${day.day})`
        }).addTo(this.map);

        const popup = L.popup({
          maxWidth: 250,
          className: 'custom-popup'
        }).setContent(`
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 5px 0; color: #e74c3c;">${spot.name}</h3>
            <p style="margin: 5px 0; color: #666;">
              <strong>Day ${day.day}</strong> - ${spot.timeSlot}<br>
              Duration: ${spot.estimatedDuration}<br>
              Category: ${spot.category || 'Tourist Spot'}
            </p>
            ${spot.mealType ? `<p style="margin: 5px 0; color: #27ae60;"><strong>${spot.mealType} time</strong></p>` : ''}
          </div>
        `);

        marker.bindPopup(popup);
        this.markers.push(marker);
        this.popups.push(popup);
      });
    });
  }

  private addHotelMarkers() {
    this.itinerary.forEach((day, dayIndex) => {
      if (day.hotelSuggestions && day.hotelSuggestions.length > 0) {
        day.hotelSuggestions.forEach((hotel, hotelIndex) => {
          if (hotel.geometry && hotel.geometry.location) {
            // Create custom icon for hotels
            const hotelIcon = L.divIcon({
              className: 'hotel-marker',
              html: `<div style="background: #1976D2; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">🏨</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });

            const marker = L.marker([hotel.geometry.location.lat, hotel.geometry.location.lng], {
              icon: hotelIcon,
              title: hotel.name
            });

            if (this.showHotels) {
              marker.addTo(this.map);
            }

            // Safely escape data for HTML
            const hotelName = hotel.name || 'Hotel Name Not Available';
            const hotelRating = hotel.rating ? `${hotel.rating}★` : 'Not Available';
            const hotelLocation = hotel.vicinity || 'Location Not Available';
            const placeId = hotel.place_id || '';
            const safeHotelData = JSON.stringify(hotel).replace(/'/g, "\\'");

            const popup = L.popup({
              maxWidth: 250,
              className: 'hotel-popup'
            }).setContent(`
              <div style="padding: 10px;">
                <h3 style="margin: 0 0 5px 0; color: #1976D2;">${hotelName}</h3>
                <p style="margin: 5px 0; color: #666;">
                  Rating: ${hotelRating}<br>
                  Location: ${hotelLocation}<br>
                  <strong>Day ${day.day} Hotel</strong>
                </p>
                <div style="margin-top: 10px;">
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="window.addHotelToItinerary('${placeId}', '${safeHotelData}')" 
                            style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                      📅 Add to Itinerary
                    </button>
                    <a href="https://www.booking.com/search.html?ss=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #1976D2; text-decoration: none; padding: 5px 8px; border: 1px solid #1976D2; border-radius: 4px; text-align: center; font-size: 12px;">
                      📖 Booking.com
                    </a>
                    <a href="https://www.agoda.com/search?q=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #E53E3E; text-decoration: none; padding: 5px 8px; border: 1px solid #E53E3E; border-radius: 4px; text-align: center; font-size: 12px;">
                      🏨 Agoda.com
                    </a>
                    <a href="https://www.hotels.com/search.do?q-destination=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #38A169; text-decoration: none; padding: 5px 8px; border: 1px solid #38A169; border-radius: 4px; text-align: center; font-size: 12px;">
                      🏢 Hotels.com
                    </a>
                    <a href="https://www.expedia.com/hotels?q=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #805AD5; text-decoration: none; padding: 5px 8px; border: 1px solid #805AD5; border-radius: 4px; text-align: center; font-size: 12px;">
                      ✈️ Expedia
                    </a>
                  </div>
                </div>
              </div>
            `);

            marker.bindPopup(popup);
            this.markers.push(marker);
            this.popups.push(popup);
          }
        });
      }
    });
}

private addRestaurantMarkers() {
    this.itinerary.forEach((day, dayIndex) => {
      day.spots.forEach((spot, spotIndex) => {
        if (spot.restaurantSuggestions && spot.restaurantSuggestions.length > 0) {
          spot.restaurantSuggestions.forEach((restaurant, restIndex) => {
            if (restaurant.geometry && restaurant.geometry.location) {
              // Create custom icon for restaurants
              const restaurantIcon = L.divIcon({
                className: 'restaurant-marker',
                html: `<div style="background: #FF9800; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">🍽️</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              });

              const marker = L.marker([restaurant.geometry.location.lat, restaurant.geometry.location.lng], {
                icon: restaurantIcon,
                title: restaurant.name
              });

              if (this.showRestaurants) {
                marker.addTo(this.map);
              }

              // Safely escape data for HTML
              const restaurantName = restaurant.name || 'Restaurant Name Not Available';
              const restaurantRating = restaurant.rating ? `${restaurant.rating}★` : 'Not Available';
              const restaurantLocation = restaurant.vicinity || 'Location Not Available';
              const placeId = restaurant.place_id || '';
              const safeRestaurantData = JSON.stringify(restaurant).replace(/'/g, "\\'");
              const mealType = spot.mealType || 'meal';

              const popup = L.popup({
                maxWidth: 250,
                className: 'restaurant-popup'
              }).setContent(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 5px 0; color: #FF9800;">${restaurantName}</h3>
                  <p style="margin: 5px 0; color: #666;">
                    Rating: ${restaurantRating}<br>
                    Location: ${restaurantLocation}<br>
                    <strong>${mealType} option</strong><br>
                    Near: ${spot.name}
                  </p>
                  <div style="margin-top: 10px;">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      <button onclick="window.addRestaurantToItinerary('${placeId}', '${safeRestaurantData}')" 
                              style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        📅 Add to Itinerary
                      </button>
                      <a href="https://www.google.com/search?q=${encodeURIComponent(restaurantName + ' reviews')}" 
                         target="_blank" style="color: #FF9800; text-decoration: none; padding: 4px 6px; border: 1px solid #FF9800; border-radius: 4px; text-align: center; font-size: 11px;">
                        🔍 Google Reviews
                      </a>
                      <a href="https://www.tripadvisor.com/search?q=${encodeURIComponent(restaurantName)}" 
                         target="_blank" style="color: #00AA6C; text-decoration: none; padding: 4px 6px; border: 1px solid #00AA6C; border-radius: 4px; text-align: center; font-size: 11px;">
                        🍽️ TripAdvisor
                      </a>
                      <a href="https://www.zomato.com/search?q=${encodeURIComponent(restaurantName)}" 
                         target="_blank" style="color: #E23744; text-decoration: none; padding: 4px 6px; border: 1px solid #E23744; border-radius: 4px; text-align: center; font-size: 11px;">
                        🍕 Zomato
                      </a>
                    </div>
                  </div>
                </div>
              `);

              marker.bindPopup(popup);
              this.markers.push(marker);
              this.popups.push(popup);
            }
          });
        }
      });
    });
}

  toggleHotels() {
    this.showHotels = !this.showHotels;
    this.markers.forEach((marker, index) => {
      // Check if this is a hotel marker by checking if it has hotel icon class
      if (marker.options.icon?.options?.className === 'hotel-marker') {
        if (this.showHotels) {
          marker.addTo(this.map);
        } else {
          marker.remove();
        }
      }
    });
  }

  toggleMapType() {
    this.useEsri = !this.useEsri;
    this.initMap(); // Reinitialize map with new tile layer
  }

  toggleRestaurants() {
    this.showRestaurants = !this.showRestaurants;
    this.markers.forEach((marker, index) => {
      // Check if this is a restaurant marker by checking if it has restaurant icon class
      if (marker.options.icon?.options?.className === 'restaurant-marker') {
        if (this.showRestaurants) {
          marker.addTo(this.map);
        } else {
          marker.remove();
        }
      }
    });
  }

  private addHighlightMarker() {
    if (this.highlightMarker) {
      this.map.removeLayer(this.highlightMarker);
    }

    const highlightIcon = L.divIcon({
      className: 'highlight-marker',
      html: `<div style="background: #FFD700; color: #000; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 4px solid #FFA500; box-shadow: 0 4px 12px rgba(255,215,0,0.6); animation: pulse 2s infinite;">⭐</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.highlightMarker = L.marker([
      this.highlightPlace.geometry.location.lat, 
      this.highlightPlace.geometry.location.lng
    ], {
      icon: highlightIcon,
      title: `Highlighted: ${this.highlightPlace.name}`
    }).addTo(this.map);

    // Center map on highlighted place
    this.map.setView([
      this.highlightPlace.geometry.location.lat, 
      this.highlightPlace.geometry.location.lng
    ], 16);

    // Add popup for highlighted place
    const popup = L.popup({
      maxWidth: 300,
      className: 'highlight-popup'
    }).setContent(`
      <div style="padding: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #FFD700; text-align: center;">⭐ Highlighted Place ⭐</h3>
        <h4 style="margin: 0 0 8px 0; color: #333;">${this.highlightPlace.name}</h4>
        <p style="margin: 5px 0; color: #666;">
          ${this.highlightPlace.rating ? `Rating: ${this.highlightPlace.rating}★<br>` : ''}
          ${this.highlightPlace.vicinity ? `Location: ${this.highlightPlace.vicinity}<br>` : ''}
        </p>
        <div style="margin-top: 12px; text-align: center;">
          <p style="color: #FFD700; font-weight: bold; margin: 0;">This place is highlighted in your itinerary!</p>
        </div>
      </div>
    `);

    this.highlightMarker.bindPopup(popup);
    this.highlightMarker.openPopup();
  }

  private clearMarkers() {
    this.markers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
    this.popups = [];
    
    if (this.highlightMarker) {
      this.map.removeLayer(this.highlightMarker);
      this.highlightMarker = undefined;
    }
  }

  async addToItinerary(place: any, placeType: 'restaurant' | 'hotel') {
    try {
      console.log('Adding to itinerary:', placeType, place);
      
      // Use the existing itinerary passed as input, or load from localStorage as fallback
      let itinerary: ItineraryDay[] = this.itinerary || [];
      
      if (itinerary.length === 0) {
        // Try to load from localStorage as fallback
        const cached = localStorage.getItem('itinerary_suggestions_cache');
        if (cached) {
          try {
            itinerary = JSON.parse(cached);
          } catch (error) {
            console.error('Error parsing cached itinerary:', error);
          }
        }
      }

      if (itinerary.length === 0) {
        // Create a new itinerary if none exists
        itinerary = [{
          day: 1,
          spots: [],
          routes: [],
          hotelSuggestions: [],
          chosenHotel: null
        }];
      }

      // Open day spot picker modal
      const modal = await this.modalCtrl.create({
        component: DaySpotPickerComponent,
        componentProps: {
          itinerary: itinerary
        },
        cssClass: 'day-picker-modal'
      });

      await modal.present();

      const result = await modal.onDidDismiss();
      
      if (result.data) {
        const { dayIndex, spotIndex } = result.data;
        
        // Create a new spot object for the itinerary
        const newSpot = {
          id: place.place_id || `place_${Date.now()}`,
          name: place.name,
          description: `${placeType === 'restaurant' ? 'Restaurant' : 'Hotel'}: ${place.name}`,
          category: placeType === 'restaurant' ? 'Restaurant' : 'Hotel',
          img: place.photos?.[0]?.photo_reference ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=YOUR_API_KEY` : 
            'assets/img/default.png',
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          timeSlot: '09:00', // Default time
          estimatedDuration: placeType === 'restaurant' ? '1 hour' : 'Overnight',
          durationMinutes: placeType === 'restaurant' ? 60 : 480,
          restaurantSuggestions: [],
          mealType: placeType === 'restaurant' ? 'lunch' : undefined,
          chosenRestaurant: null,
          customTime: false
        };

        // Add the spot to the selected position
        itinerary[dayIndex].spots.splice(spotIndex, 0, newSpot);
        
        // Update time slots for the day
        this.itineraryService.updateTimeSlots(itinerary[dayIndex]);
        
        // Update the input itinerary reference
        this.itinerary = itinerary;
        
        // Save updated itinerary to localStorage
        localStorage.setItem('itinerary_suggestions_cache', JSON.stringify(itinerary));
        
        // Show success message
        const alert = await this.alertCtrl.create({
          header: 'Success',
          message: `${place.name} has been added to Day ${itinerary[dayIndex].day} at position ${spotIndex + 1}`,
          buttons: ['OK']
        });
        await alert.present();
      }
    } catch (error) {
      console.error('Error adding to itinerary:', error);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to add place to itinerary. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }
} 