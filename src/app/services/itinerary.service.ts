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
    if (!spots || spots.length === 0) {
      return [];
    }

    const days: any[] = Array.from({ length: numDays }, () => []);
    spots.forEach((spot, i) => {
      days[i % numDays].push(spot);
    });
    
    const itinerary: ItineraryDay[] = [];
    
    for (let day = 0; day < days.length; day++) {
      const daySpots = days[day];
      if (daySpots.length === 0) continue;
      
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
      const totalMinutes = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60));
      const slotMinutes = Math.max(30, Math.floor(totalMinutes / totalSpots)); // Minimum 30 minutes per spot
      
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
          mealType,
          durationMinutes: slotMinutes
        });
        
        // Move to next time slot
        currentTime = new Date(currentTime.getTime() + slotMinutes * 60000);
        
        // Generate comprehensive route chain for the day
        if (i === daySpots.length - 1) { // Only generate routes once at the end of the day
          await this.generateRouteChain(dayPlan);
        }
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
    
    // Validate the date is not invalid
    if (isNaN(d.getTime())) {
      console.warn('Invalid date created, using current date as fallback');
      d = new Date();
      d.setHours(h, m, 0, 0);
    }
    
    return d;
  }

  private formatTime(date: Date): string {
    // Check if date is valid before formatting
    if (isNaN(date.getTime())) {
      console.warn('Invalid date passed to formatTime, returning default time');
      return '09:00';
    }
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
    
    try {
      const result: any = await this.directionsService.getTransitRoute(
        `${fromSpot.location.lat},${fromSpot.location.lng}`,
        `${toSpot.location.lat},${toSpot.location.lng}`
      ).toPromise();
      
      if (result.status === 'OK' && result.routes && result.routes.length > 0) {
        const steps = result.routes[0].legs[0].steps;
        const transitSteps = steps.filter((s: any) => s.travel_mode === 'TRANSIT');
        return {
          type: 'transit',
          details: transitSteps.map((s: any) => ({
            code: s.transit_details?.line?.short_name || 'Unknown',
            vehicle: s.transit_details?.line?.vehicle?.type || 'transit',
            instructions: s.html_instructions || s.instructions || 'Continue on route',
            polyline: s.polyline?.points
          }))
        };
      } else {
        return { type: 'none', message: 'No route found' };
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      return { type: 'error', message: 'Failed to fetch directions' };
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

  // Find jeepney route between two spots
  private async findJeepneyRoute(fromSpot: ItinerarySpot, toSpot: ItinerarySpot): Promise<any> {
    try {
      // Find jeepney routes that pass through both spots
      const routesSnap = await this.firestore.collection('jeepney_routes', ref =>
        ref.where('points', 'array-contains', { lat: toSpot.location.lat, lng: toSpot.location.lng })
      ).get().toPromise();

      if (!routesSnap || routesSnap.empty) {
        return null;
      }

      let bestRoute: any = null;
      let minDistance = Infinity;

      // Find the route that has the closest start point to the fromSpot
      for (const doc of routesSnap.docs) {
        const route = doc.data() as any;
        if (!route.points || route.points.length < 2) continue;

        // Find the closest point in the route to fromSpot
        let closestPoint = route.points[0];
        let minDist = this.getDistance(fromSpot.location, closestPoint);

        for (const point of route.points) {
          const dist = this.getDistance(fromSpot.location, point);
          if (dist < minDist) {
            minDist = dist;
            closestPoint = point;
          }
        }

        // If this route is better than previous best, update
        if (minDist < minDistance) {
          minDistance = minDist;
          bestRoute = {
            code: route.code,
            startPoint: closestPoint,
            endPoint: { lat: toSpot.location.lat, lng: toSpot.location.lng },
            estimatedTime: this.calculateJeepneyTime(route.points, closestPoint, toSpot.location)
          };
        }
      }

      return bestRoute;
    } catch (error) {
      console.error('Error finding jeepney route:', error);
      return null;
    }
  }

  // Calculate distance between two points
  private getDistance(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const lat1 = this.toRad(a.lat);
    const lat2 = this.toRad(b.lat);

    const a1 = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  // Calculate estimated jeepney travel time
  private calculateJeepneyTime(routePoints: any[], startPoint: any, endPoint: any): string {
    // Find the indices of start and end points in the route
    let startIndex = 0;
    let endIndex = routePoints.length - 1;

    for (let i = 0; i < routePoints.length; i++) {
      if (this.getDistance(routePoints[i], startPoint) < 0.1) { // Within 100m
        startIndex = i;
      }
      if (this.getDistance(routePoints[i], endPoint) < 0.1) { // Within 100m
        endIndex = i;
      }
    }

    // Calculate distance between start and end
    const distance = Math.abs(endIndex - startIndex) * 0.5; // Rough estimate: 0.5km per point
    const timeMinutes = Math.max(10, Math.round(distance * 2)); // Rough estimate: 2 min per km

    return `${timeMinutes} min`;
  }

  // Generate comprehensive route chain for a day
  private async generateRouteChain(dayPlan: ItineraryDay): Promise<void> {
    const routeChain: any[] = [];
    
    // Get user's current location (you can enhance this to get actual user location)
    const userLocation = await this.getUserLocation();
    
    // Start from user location to first spot
    if (dayPlan.spots.length > 0) {
      const firstSpot = dayPlan.spots[0];
      const routeToFirst = await this.findJeepneyRoute(
        { name: 'Your Location', location: userLocation } as ItinerarySpot,
        firstSpot
      );
      
      if (routeToFirst) {
        routeChain.push({
          from: 'Your Location',
          to: firstSpot.name,
          jeepneyCode: routeToFirst.code,
          startPoint: routeToFirst.startPoint,
          endPoint: routeToFirst.endPoint,
          estimatedTime: routeToFirst.estimatedTime || '15-30 min',
          type: 'user_to_spot'
        });
      }
    }
    
    // Generate routes between spots, including restaurants
    for (let i = 0; i < dayPlan.spots.length; i++) {
      const currentSpot = dayPlan.spots[i];
      const nextSpot = dayPlan.spots[i + 1];
      
      // If current spot has a chosen restaurant, add route to restaurant
      if (currentSpot.chosenRestaurant && currentSpot.chosenRestaurant.location) {
        const routeToRestaurant = await this.findJeepneyRoute(
          currentSpot,
          { 
            name: currentSpot.chosenRestaurant.name, 
            location: currentSpot.chosenRestaurant.location 
          } as ItinerarySpot
        );
        
        if (routeToRestaurant) {
          routeChain.push({
            from: currentSpot.name,
            to: currentSpot.chosenRestaurant.name,
            jeepneyCode: routeToRestaurant.code,
            startPoint: routeToRestaurant.startPoint,
            endPoint: routeToRestaurant.endPoint,
            estimatedTime: routeToRestaurant.estimatedTime || '5-15 min',
            type: 'spot_to_restaurant',
            mealType: currentSpot.mealType
          });
        }
        
        // Route from restaurant to next spot (or hotel if last spot)
        if (nextSpot) {
          const routeFromRestaurant = await this.findJeepneyRoute(
            { 
              name: currentSpot.chosenRestaurant.name, 
              location: currentSpot.chosenRestaurant.location 
            } as ItinerarySpot,
            nextSpot
          );
          
          if (routeFromRestaurant) {
            routeChain.push({
              from: currentSpot.chosenRestaurant.name,
              to: nextSpot.name,
              jeepneyCode: routeFromRestaurant.code,
              startPoint: routeFromRestaurant.startPoint,
              endPoint: routeFromRestaurant.endPoint,
              estimatedTime: routeFromRestaurant.estimatedTime || '15-30 min',
              type: 'restaurant_to_spot'
            });
          }
        }
      } else if (nextSpot) {
        // Direct route from current spot to next spot (no restaurant)
        const routeToNext = await this.findJeepneyRoute(currentSpot, nextSpot);
        
        if (routeToNext) {
          routeChain.push({
            from: currentSpot.name,
            to: nextSpot.name,
            jeepneyCode: routeToNext.code,
            startPoint: routeToNext.startPoint,
            endPoint: routeToNext.endPoint,
            estimatedTime: routeToNext.estimatedTime || '15-30 min',
            type: 'spot_to_spot'
          });
        }
      }
    }
    
    // Route from last spot to hotel (if hotel is chosen)
    if (dayPlan.chosenHotel && dayPlan.chosenHotel.location && dayPlan.spots.length > 0) {
      const lastSpot = dayPlan.spots[dayPlan.spots.length - 1];
      const routeToHotel = await this.findJeepneyRoute(
        lastSpot,
        { 
          name: dayPlan.chosenHotel.name, 
          location: dayPlan.chosenHotel.location 
        } as ItinerarySpot
      );
      
      if (routeToHotel) {
        routeChain.push({
          from: lastSpot.name,
          to: dayPlan.chosenHotel.name,
          jeepneyCode: routeToHotel.code,
          startPoint: routeToHotel.startPoint,
          endPoint: routeToHotel.endPoint,
          estimatedTime: routeToHotel.estimatedTime || '15-30 min',
          type: 'spot_to_hotel'
        });
      }
    }
    
    // Update the day plan with the complete route chain
    dayPlan.routes = routeChain;
  }

  // Get user's current location (placeholder - enhance with actual location service)
  private async getUserLocation(): Promise<{ lat: number; lng: number }> {
    // For now, return a default location in Cebu City
    // You can enhance this to use Geolocation API or get from user profile
    return { lat: 10.3157, lng: 123.8854 }; // Cebu City center
  }
} 