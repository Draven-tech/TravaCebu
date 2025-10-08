import { Component, Input, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as L from 'leaflet';
import { ItineraryDay, ItineraryService } from '../../services/itinerary.service';
import { DaySpotPickerComponent } from '../day-spot-picker/day-spot-picker.component';
import { PlaceAssignmentPickerComponent } from '../place-assignment-picker/place-assignment-picker.component';
import { AlertController } from '@ionic/angular';


@Component({
  selector: 'app-itinerary-map',
  templateUrl: './itinerary-map.component.html',
  styleUrls: ['./itinerary-map.component.scss'],
  standalone: false,
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
    (window as any).addRestaurantToItinerary = (placeId: string) => {
      this.ngZone.run(() => {
        // Find the restaurant data from the itinerary
        let restaurant: any = null;
        for (const day of this.itinerary) {
          for (const spot of day.spots) {
            if (spot.restaurantSuggestions) {
              const found = spot.restaurantSuggestions.find((r: any) => r.place_id === placeId);
              if (found) {
                restaurant = found;
                break;
              }
            }
          }
          if (restaurant) break;
        }
        
        if (restaurant) {
          this.addToItinerary(restaurant, 'restaurant');
        } else {
          console.error('Restaurant not found for placeId:', placeId);
        }
      });
    };

    (window as any).addHotelToItinerary = (placeId: string) => {
      this.ngZone.run(() => {
        // Find the hotel data from the itinerary
        let hotel: any = null;
        for (const day of this.itinerary) {
          if (day.hotelSuggestions) {
            const found = day.hotelSuggestions.find((h: any) => h.place_id === placeId);
            if (found) {
              hotel = found;
              break;
            }
          }
        }
        
        if (hotel) {
          this.addToItinerary(hotel, 'hotel');
        } else {
          console.error('Hotel not found for placeId:', placeId);
        }
      });
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
      return;
    }

    // Get center point from first tourist spot
    const firstSpot = this.itinerary[0]?.spots[0];
    if (!firstSpot) {
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
          attribution: 'Satellite Imagery Â© Esri',
          maxZoom: 19
        }).addTo(this.map);
      } else {
        // OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Â© OpenStreetMap contributors',
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
              html: `<div style="background: #1976D2; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">ðŸ¨</div>`,
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
            const hotelRating = hotel.rating ? `${hotel.rating}â˜…` : 'Not Available';
            const hotelLocation = hotel.vicinity || 'Location Not Available';
            const placeId = hotel.place_id || '';

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
                    <button onclick="window.addHotelToItinerary('${placeId}')" 
                            style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                      ðŸ“… Add to Itinerary
                    </button>
                    <a href="https://www.booking.com/search.html?ss=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #1976D2; text-decoration: none; padding: 5px 8px; border: 1px solid #1976D2; border-radius: 4px; text-align: center; font-size: 12px;">
                      ðŸ“– Booking.com
                    </a>
                    <a href="https://www.agoda.com/search?q=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #E53E3E; text-decoration: none; padding: 5px 8px; border: 1px solid #E53E3E; border-radius: 4px; text-align: center; font-size: 12px;">
                      ðŸ¨ Agoda.com
                    </a>
                    <a href="https://www.hotels.com/search.do?q-destination=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #38A169; text-decoration: none; padding: 5px 8px; border: 1px solid #38A169; border-radius: 4px; text-align: center; font-size: 12px;">
                      ðŸ¢ Hotels.com
                    </a>
                    <a href="https://www.expedia.com/hotels?q=${encodeURIComponent(hotelName)}" 
                       target="_blank" style="color: #805AD5; text-decoration: none; padding: 5px 8px; border: 1px solid #805AD5; border-radius: 4px; text-align: center; font-size: 12px;">
                      âœˆï¸ Expedia
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
                html: `<div style="background: #FF9800; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">ðŸ½ï¸</div>`,
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
              const restaurantRating = restaurant.rating ? `${restaurant.rating}â˜…` : 'Not Available';
              const restaurantLocation = restaurant.vicinity || 'Location Not Available';
              const placeId = restaurant.place_id || '';
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
                      <button onclick="window.addRestaurantToItinerary('${placeId}')" 
                              style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        ðŸ“… Add to Itinerary
                      </button>
                      <a href="https://www.google.com/search?q=${encodeURIComponent(restaurantName + ' reviews')}" 
                         target="_blank" style="color: #FF9800; text-decoration: none; padding: 4px 6px; border: 1px solid #FF9800; border-radius: 4px; text-align: center; font-size: 11px;">
                        ðŸ” Google Reviews
                      </a>
                      <a href="https://www.tripadvisor.com/search?q=${encodeURIComponent(restaurantName)}" 
                         target="_blank" style="color: #00AA6C; text-decoration: none; padding: 4px 6px; border: 1px solid #00AA6C; border-radius: 4px; text-align: center; font-size: 11px;">
                        ðŸ½ï¸ TripAdvisor
                      </a>
                      <a href="https://www.zomato.com/search?q=${encodeURIComponent(restaurantName)}" 
                         target="_blank" style="color: #E23744; text-decoration: none; padding: 4px 6px; border: 1px solid #E23744; border-radius: 4px; text-align: center; font-size: 11px;">
                        ðŸ• Zomato
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
      html: `<div style="background: #FFD700; color: #000; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 4px solid #FFA500; box-shadow: 0 4px 12px rgba(255,215,0,0.6); animation: pulse 2s infinite;">â­</div>`,
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
        <h3 style="margin: 0 0 10px 0; color: #FFD700; text-align: center;">â­ Highlighted Place â­</h3>
        <h4 style="margin: 0 0 8px 0; color: #333;">${this.highlightPlace.name}</h4>
        <p style="margin: 5px 0; color: #666;">
          ${this.highlightPlace.rating ? `Rating: ${this.highlightPlace.rating}â˜…<br>` : ''}
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
        // Show error if no itinerary exists
        const alert = await this.alertCtrl.create({
          header: 'No Itinerary Found',
          message: 'Please create an itinerary first before adding places to it.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Open place assignment picker modal
      const modal = await this.modalCtrl.create({
        component: PlaceAssignmentPickerComponent,
        componentProps: {
          itinerary: itinerary,
          placeName: place.name,
          placeType: placeType
        },
        cssClass: 'assignment-picker-modal'
      });

      await modal.present();

      const result = await modal.onDidDismiss();
      
      if (result.data) {
        if (result.data.type === 'restaurant') {
          // Assign restaurant to existing meal spot
          const { dayIndex, spotIndex } = result.data;
          const spot = itinerary[dayIndex].spots[spotIndex];
          
          // Assign restaurant like the suggestion system does
          spot.chosenRestaurant = {
            ...place,
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            }
          };
          
          // Show success message
          const alert = await this.alertCtrl.create({
            header: 'Success',
            message: `${place.name} has been assigned to ${spot.name} (${spot.mealType} time) on Day ${itinerary[dayIndex].day}`,
            buttons: ['OK']
          });
          await alert.present();
          
        } else if (result.data.type === 'hotel') {
          // Assign hotel to day
          const { dayIndex } = result.data;
          const day = itinerary[dayIndex];
          
          // Assign hotel like the suggestion system does
          day.chosenHotel = {
            ...place,
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            }
          };
          
          // Show success message
          const alert = await this.alertCtrl.create({
            header: 'Success',
            message: `${place.name} has been assigned as the hotel for Day ${day.day}`,
            buttons: ['OK']
          });
          await alert.present();
        }
        
        // Update the input itinerary reference
        this.itinerary = itinerary;
        
        // Save updated itinerary to localStorage
        localStorage.setItem('itinerary_suggestions_cache', JSON.stringify(itinerary));
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
