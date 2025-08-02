import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DirectionsService } from './directions.service';
import { ApiTrackerService } from './api-tracker.service';
import { PlacesService } from './places.service';

export interface ItinerarySpot {
  id: string;
  name: string;
  description?: string;
  category?: string;
  img?: string;
  location: { lat: number; lng: number };
  timeSlot?: string;
  estimatedDuration?: string;
  restaurantSuggestions?: any[];
  mealType?: string;
  durationMinutes?: number;
  chosenRestaurant?: any;
  customTime?: boolean;
}

export interface ItineraryDay {
  day: number;
  date?: string; // Add date for calendar integration
  spots: ItinerarySpot[];
  routes: any[];
  hotelSuggestions?: any[];
  chosenHotel?: any;
}

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  constructor(
    private firestore: AngularFirestore,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private placesService: PlacesService
  ) {}

  // Generate itinerary with meal/hotel slots, but no suggestions
  async generateItinerary(
    spots: any[],
    numDays: number,
    startTime: string = '08:00',
    endTime: string = '18:00',
    startDate?: string
  ): Promise<ItineraryDay[]> {
    const days: any[] = Array.from({ length: numDays }, () => []);
    spots.forEach((spot, i) => {
      days[i % numDays].push(spot);
    });
    const itinerary: ItineraryDay[] = [];
    for (let day = 0; day < days.length; day++) {
      const daySpots = days[day];
      const dayPlan: ItineraryDay = { day: day + 1, spots: [], routes: [] };
      
      // Calculate the date for this day
      if (startDate) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + day);
        dayPlan.date = dayDate.toISOString().split('T')[0];
      }
      const totalSpots = daySpots.length;
      const start = this.parseTime(startTime, startDate);
      const end = this.parseTime(endTime, startDate);
      const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const slotMinutes = Math.floor(totalMinutes / totalSpots);
      let currentTime = new Date(start);
      for (let i = 0; i < daySpots.length; i++) {
        const spotData = daySpots[i];
        const timeSlot = this.formatTime(currentTime);
        const estimatedDuration = `${slotMinutes} min`;
        const mealType = this.getMealType(currentTime);
        dayPlan.spots.push({
          ...spotData,
          timeSlot,
          estimatedDuration,
          mealType
        });
        currentTime = new Date(currentTime.getTime() + slotMinutes * 60000);
        // Skip jeepney routes for now to avoid permission issues
        // Routes can be added later when needed
      }
      itinerary.push(dayPlan);
    }
    return itinerary;
  }

  // Fetch and cache restaurant/hotel suggestions for a finalized itinerary
  async fetchSuggestionsForItinerary(itinerary: ItineraryDay[], logFn?: (msg: string) => void): Promise<ItineraryDay[]> {
    // TEMPORARILY DISABLE CACHING TO FORCE FRESH FETCH
    // logFn?.('[DEBUG] Caching disabled, fetching fresh suggestions...');
    
    // Fetch fresh suggestions
    for (const day of itinerary) {
      // Fetch restaurant suggestions for meal times
      for (const spot of day.spots) {
        if (spot.mealType) {
          try {
            const restRes: any = await this.placesService.getNearbyPlaces(spot.location.lat, spot.location.lng, 'restaurant').toPromise();
            spot.restaurantSuggestions = restRes.results || [];
          } catch (error) {
            console.error(`Error fetching restaurants for ${spot.name}:`, error);
            spot.restaurantSuggestions = [];
          }
        }
      }
      
      // Fetch hotel suggestions for last spot of the day
      if (day.spots.length > 0) {
        const lastSpot = day.spots[day.spots.length - 1];
        try {
          const hotelRes: any = await this.placesService.getNearbyPlaces(lastSpot.location.lat, lastSpot.location.lng, 'lodging').toPromise();
          day.hotelSuggestions = hotelRes.results || [];
        } catch (error) {
          console.error(`Error fetching hotels for Day ${day.day}:`, error);
          day.hotelSuggestions = [];
        }
      }
    }
    
    return itinerary;
  }

  // Helper: create a cache key based on spot IDs and time slots
  private getCacheKey(itinerary: ItineraryDay[]): string {
    const key = itinerary.map(day => day.spots.map(s => s.id).join('-')).join('|');
    return 'itinerary_suggestions_' + key;
  }

  private parseTime(time: string, startDate?: string): Date {
    const [h, m] = time.split(':').map(Number);
    let d: Date;
    
    if (startDate) {
      // Use the provided start date
      d = new Date(startDate);
      d.setHours(h, m, 0, 0);
    } else {
      // Use current date as fallback
      d = new Date();
      d.setHours(h, m, 0, 0);
    }
    
    return d;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private getMealType(date: Date): string | null {
    const hour = date.getHours();
    if (hour >= 6 && hour < 10) return 'breakfast';
    if (hour >= 11 && hour < 14) return 'lunch';
    if (hour >= 18 && hour < 21) return 'dinner';
    return null;
  }

  async getDirectionsRoute(fromSpot: any, toSpot: any): Promise<any> {
    const canCall = await this.apiTracker.canCallApiToday('directions', 100);
    if (!canCall) {
      return { type: 'limit', message: 'API limit reached' };
    }
    this.apiTracker.logApiCall('directions', 'route', { from: fromSpot.location, to: toSpot.location });
    const result: any = await this.directionsService.getTransitRoute(
      `${fromSpot.location.lat},${fromSpot.location.lng}`,
      `${toSpot.location.lat},${toSpot.location.lng}`
    ).toPromise();
    if (result.status === 'OK' && result.routes.length > 0) {
      const steps = result.routes[0].legs[0].steps;
      const transitSteps = steps.filter((s: any) => s.travel_mode === 'TRANSIT');
      return {
        type: 'transit',
        details: transitSteps.map((s: any) => ({
          code: s.transit_details?.line?.short_name,
          vehicle: s.transit_details?.line?.vehicle?.type,
          instructions: s.html_instructions,
          polyline: s.polyline?.points
        }))
      };
    } else {
      return { type: 'none', message: 'No route found' };
    }
  }

  // Test API connection and return the full response
  async testApiConnection(): Promise<any> {
    try {
      console.log('🧪 Testing API connection...');
      const testResult = await this.placesService.testApiKey().toPromise();
      console.log('API Test Result:', testResult);
      return testResult;
    } catch (error) {
      console.error('❌ API connection test error:', error);
      return { status: 'ERROR', error: (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error) };
    }
  }

  // Update time slots for a day's spots
  updateTimeSlots(day: ItineraryDay, startTime: string = '08:00'): void {
    if (!day.spots || day.spots.length === 0) return;

    let currentTime = this.parseTime(startTime);
    
    for (let i = 0; i < day.spots.length; i++) {
      const spot = day.spots[i];
      
      // Only update time if it's not custom
      if (!spot.customTime) {
        spot.timeSlot = this.formatTime(currentTime);
      }
      
      // Calculate end time for this spot
      const durationMinutes = spot.durationMinutes || 120;
      const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      // Update estimated duration
      spot.estimatedDuration = `${durationMinutes} min`;
      
      // Set current time to end time for next spot
      currentTime = endTime;
    }
  }
} 