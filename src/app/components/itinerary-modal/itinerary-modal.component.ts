import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { ItineraryEditorComponent } from '../itinerary-editor/itinerary-editor.component';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../../services/itinerary.service';
import { ItineraryMapComponent } from '../itinerary-map/itinerary-map.component';
import { CalendarService, CalendarEvent } from '../../services/calendar.service';

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
  templateUrl: './itinerary-modal.component.html',
  styleUrls: ['./itinerary-modal.component.scss'],
  standalone: false,
})
export class ItineraryModalComponent implements OnInit {
  @Input() itinerary: ItineraryDay[] = [];
  @Input() itineraryName: string = '';
  @Input() originalStartTime: string = '';
  @Input() originalEndTime: string = '';
  @Input() originalSpots: any[] = [];

  private originalDates: string[] = [];

  fetchingSuggestions = false;
  saving = false;
  suggestionsVisible: { [key: string]: boolean } = {};

  constructor(
    private modalCtrl: ModalController,
    private itineraryService: ItineraryService,
    private cdr: ChangeDetectorRef,
    private calendarService: CalendarService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) { }

  async ngOnInit() {
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

  toggleSuggestions(spotKey: string) {
    this.suggestionsVisible[spotKey] = !this.suggestionsVisible[spotKey];
  }

  areSuggestionsVisible(spotKey: string): boolean {
    return !!this.suggestionsVisible[spotKey];
  }


  getSpotKey(dayIndex: number, spotIndex: number): string {
    return `day${dayIndex}_spot${spotIndex}`;
  }

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

      const [hoursA, minutesA] = timeA.split(':').map(Number);
      const [hoursB, minutesB] = timeB.split(':').map(Number);

      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;

      return totalMinutesA - totalMinutesB;
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
      for (const day of this.itinerary) {
        await this.itineraryService.generateCompleteRouteInfo(day);
      }


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

      for (const spot of day.spots) {
        if (spot.mealType && !spot.chosenRestaurant) {
          return {
            isValid: false,
            message: `Please select a restaurant or skip for ${spot.name} (${spot.mealType} time)`
          };
        }
      }

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
    const itineraryDates = this.itinerary.map(day => day.date).filter((date): date is string => date !== undefined);

    const datesToClear = [...new Set([...this.originalDates, ...itineraryDates])];
    await this.calendarService.clearEventsForDates(datesToClear);

    const events: CalendarEvent[] = [];
    const itineraryGroupId = `itinerary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const finalItineraryName = (this.itineraryName || '').trim() || (await this.calendarService.getNextDefaultItineraryName());

    for (const day of this.itinerary) {
      if (!day.date) {
        throw new Error('Itinerary days must have dates assigned');
      }

      for (const spot of day.spots) {
        const canonicalSpotId = spot.touristSpotId || spot.spotId || spot.id;

        if (!canonicalSpotId) {
          console.warn('[ItineraryModalComponent] Skipping spot without a Firestore ID when creating calendar events.', spot);
          continue;
        }

        const startTime = `${day.date}T${spot.timeSlot}:00`;
        const event: CalendarEvent = {
          id: canonicalSpotId,
          title: spot.name,
          start: startTime,
          end: startTime,
          color: '#28a745',
          textColor: '#fff',
          allDay: false,
          extendedProps: {
            type: 'tourist_spot',
            itineraryName: finalItineraryName,
            description: spot.description || '',
            category: spot.category || 'GENERAL',
            duration: spot.estimatedDuration || '2 hours',
            restaurant: spot.chosenRestaurant?.name || null,
            restaurantRating: spot.chosenRestaurant?.rating || null,
            restaurantVicinity: spot.chosenRestaurant?.vicinity || null,
            mealType: spot.mealType || null,
            spotId: canonicalSpotId,
            touristSpotId: canonicalSpotId,
            itineraryGroupId,

            originalStartTime: this.originalStartTime,
            originalEndTime: this.originalEndTime
          }
        };
        events.push(event);


        if (spot.chosenRestaurant && spot.chosenRestaurant.name !== 'User will decide on the day') {
          const spotStartTime = new Date(startTime);
          let restaurantTime: Date;

          const spotHour = spotStartTime.getHours();
          const mealType = spot.mealType?.toLowerCase() || '';

          if (mealType.includes('breakfast') || spotHour < 10) {
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else if (mealType.includes('lunch') || (spotHour >= 10 && spotHour < 14)) {
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else if (mealType.includes('dinner') || spotHour >= 14) {
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          } else {
            restaurantTime = new Date(spotStartTime.getTime() + 30 * 60000);
          }

          const year = restaurantTime.getFullYear();
          const month = String(restaurantTime.getMonth() + 1).padStart(2, '0');
          const day = String(restaurantTime.getDate()).padStart(2, '0');
          const hours = String(restaurantTime.getHours()).padStart(2, '0');
          const minutes = String(restaurantTime.getMinutes()).padStart(2, '0');
          const restaurantStartTime = `${year}-${month}-${day}T${hours}:${minutes}:00`;

          const restaurantEvent: CalendarEvent = {
            title: `${spot.chosenRestaurant.name}`,
            start: restaurantStartTime,
            end: restaurantStartTime,
            color: '#ff9800',
            textColor: '#fff',
            allDay: false,
            extendedProps: {
              type: 'restaurant',
              itineraryName: finalItineraryName,
              description: `${spot.mealType} at ${spot.chosenRestaurant.name}`,
              restaurant: spot.chosenRestaurant.name || '',
              vicinity: spot.chosenRestaurant.vicinity || '',
              rating: spot.chosenRestaurant.rating || null,
              mealType: spot.mealType || '',
              isChosen: true,
              isItineraryEvent: true,
              itineraryGroupId
            }
          };

          if (spot.chosenRestaurant.location && spot.chosenRestaurant.location.lat && spot.chosenRestaurant.location.lng) {
            restaurantEvent.extendedProps.location = spot.chosenRestaurant.location;
          }
          events.push(restaurantEvent);
        }
      }

      if (day.chosenHotel) {
        const hotelStartTime = `${day.date}T18:00:00`;
        const hotelEvent: CalendarEvent = {
          title: `${day.chosenHotel.name}`,
          start: hotelStartTime,
          end: hotelStartTime,
          color: '#3880ff',
          textColor: '#fff',
          allDay: false,
          extendedProps: {
            type: 'hotel',
            itineraryName: finalItineraryName,
            description: 'Hotel check-in',
            hotel: day.chosenHotel.name || '',
            vicinity: day.chosenHotel.vicinity || '',
            rating: day.chosenHotel.rating || null,
            isChosen: true,
            isItineraryEvent: true,
            itineraryGroupId
          }
        };

        if (day.chosenHotel.location && day.chosenHotel.location.lat && day.chosenHotel.location.lng) {
          hotelEvent.extendedProps.location = day.chosenHotel.location;
        }
        events.push(hotelEvent);

      }
    }

    await this.calendarService.saveItineraryEvents(events);
  }

  chooseRestaurant(spot: ItinerarySpot, restaurant: any) {

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

    this.originalDates = this.itinerary.map(day => day.date).filter((date): date is string => date !== undefined);

    const modal = await this.modalCtrl.create({
      component: ItineraryEditorComponent,
      componentProps: {
        itinerary: this.itinerary,
        availableSpots: this.originalSpots
      },
      cssClass: 'itinerary-editor-modal'
    });
    modal.onDidDismiss().then(async result => {
      if (result.data) {
        this.itinerary = result.data;

        this.cdr.detectChanges();

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

    setTimeout(() => {
      if (document.body.contains(alertDiv)) {
        document.body.removeChild(alertDiv);
      }
    }, 3000);
  }

  private getItineraryId(): string {
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
