import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DirectionsService } from './directions.service';
import { ApiTrackerService } from './api-tracker.service';
import { PlacesService } from './places.service';
import { Geolocation } from '@capacitor/geolocation';

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

    // Sort spots by location proximity for efficient routing
    const sortedSpots = this.sortSpotsByProximity(spots);
    const days: any[] = Array.from({ length: numDays }, () => []);
    sortedSpots.forEach((spot, i) => {
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
          await this.generateCompleteRouteChain(dayPlan);
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
      const testResult = await this.placesService.testApiKey().toPromise();
      return testResult;
    } catch (error) {
      console.error('âŒ API connection test error:', error);
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

  // Sort spots by proximity to create efficient routes
  private sortSpotsByProximity(spots: any[]): any[] {
    if (spots.length <= 1) {
      return spots;
    }

    // Filter out spots without valid location data
    const validSpots = spots.filter(spot => 
      spot.location && 
      typeof spot.location.lat === 'number' && 
      typeof spot.location.lng === 'number' &&
      !isNaN(spot.location.lat) && 
      !isNaN(spot.location.lng)
    );

    if (validSpots.length <= 1) {
      return spots; // Return original if no valid spots to sort
    }

    // Create a copy to avoid modifying the original array
    const sortedSpots = [...validSpots];
    
    // Use a greedy nearest neighbor algorithm with optimization
    const result: any[] = [];
    const unvisited = new Set(sortedSpots.map((_, index) => index));
    
    // Start with the spot that has the most central location (closest to average)
    const avgLat = sortedSpots.reduce((sum, spot) => sum + spot.location.lat, 0) / sortedSpots.length;
    const avgLng = sortedSpots.reduce((sum, spot) => sum + spot.location.lng, 0) / sortedSpots.length;
    
    let currentIndex = 0;
    let minDistanceToCenter = Infinity;
    
    // Find the spot closest to the center to start
    for (let i = 0; i < sortedSpots.length; i++) {
      const distance = this.getDistance(
        sortedSpots[i].location,
        { lat: avgLat, lng: avgLng }
      );
      if (distance < minDistanceToCenter) {
        minDistanceToCenter = distance;
        currentIndex = i;
      }
    }
    
    result.push(sortedSpots[currentIndex]);
    unvisited.delete(currentIndex);
    
    // Find the nearest unvisited spot repeatedly
    while (unvisited.size > 0) {
      let nearestIndex = -1;
      let minDistance = Infinity;
      
      for (const index of unvisited) {
        const distance = this.getDistance(
          sortedSpots[currentIndex].location,
          sortedSpots[index].location
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      }
      
      if (nearestIndex !== -1) {
        result.push(sortedSpots[nearestIndex]);
        unvisited.delete(nearestIndex);
        currentIndex = nearestIndex;
      } else {
        // Fallback: add remaining spots in original order
        for (const index of unvisited) {
          result.push(sortedSpots[index]);
        }
        break;
      }
    }
    
    // Add back any spots that were filtered out (invalid locations)
    const invalidSpots = spots.filter(spot => 
      !spot.location || 
      typeof spot.location.lat !== 'number' || 
      typeof spot.location.lng !== 'number' ||
      isNaN(spot.location.lat) || 
      isNaN(spot.location.lng)
    );
    
    return [...result, ...invalidSpots];
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

  // Enhanced route generation with complete chain including user location
  async generateCompleteRouteChain(dayPlan: ItineraryDay): Promise<void> {
    const routeChain: any[] = [];
    
    // Get user's current location
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
          type: 'user_to_spot',
          description: 'From your current location to the first tourist spot'
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
            mealType: currentSpot.mealType,
            description: `From ${currentSpot.name} to ${currentSpot.chosenRestaurant.name} for ${currentSpot.mealType}`
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
              type: 'restaurant_to_spot',
              description: `From ${currentSpot.chosenRestaurant.name} to ${nextSpot.name}`
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
            type: 'spot_to_spot',
            description: `From ${currentSpot.name} to ${nextSpot.name}`
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
          type: 'spot_to_hotel',
          description: `From ${lastSpot.name} to ${dayPlan.chosenHotel.name} for check-in`
        });
      }
    }
    
    // Update the day plan with the complete route chain
    dayPlan.routes = routeChain;
  }

  // Get user's current location using Capacitor Geolocation
  private async getUserLocation(): Promise<{ lat: number; lng: number }> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      });
      
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (error) {
      console.warn('Could not get user location, using default Cebu City center:', error);
      // Fallback to Cebu City center
      return { lat: 10.3157, lng: 123.8854 };
    }
  }

  // Get Google Directions for a specific route segment
  async getGoogleDirectionsForRoute(fromSpot: any, toSpot: any): Promise<any> {
    const canCall = await this.apiTracker.canCallApiToday('directions', 100);
    if (!canCall) {
      return { type: 'limit', message: 'API limit reached' };
    }
    
    this.apiTracker.logApiCall('directions', 'route', { 
      from: fromSpot.location, 
      to: toSpot.location 
    });
    
    try {
      const result: any = await this.directionsService.getTransitRoute(
        `${fromSpot.location.lat},${fromSpot.location.lng}`,
        `${toSpot.location.lat},${toSpot.location.lng}`
      ).toPromise();
      
      if (result.status === 'OK' && result.routes && result.routes.length > 0) {
        const route = result.routes[0];
        const leg = route.legs[0];
        
        return {
          type: 'success',
          duration: leg.duration.text,
          distance: leg.distance.text,
          steps: leg.steps.map((step: any) => ({
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
            distance: step.distance.text,
            duration: step.duration.text,
            mode: step.travel_mode,
            transit_details: step.transit_details ? {
              line: step.transit_details.line,
              vehicle: step.transit_details.line?.vehicle,
              departure_stop: step.transit_details.departure_stop,
              arrival_stop: step.transit_details.arrival_stop
            } : null
          })),
          polyline: route.overview_polyline.points
        };
      } else {
        return { type: 'none', message: 'No route found' };
      }
    } catch (error) {
      console.error('Error fetching Google directions:', error);
      return { type: 'error', message: 'Failed to fetch directions' };
    }
  }

  // Generate complete route information for a day (both jeepney and Google directions)
  async generateCompleteRouteInfo(dayPlan: ItineraryDay): Promise<void> {
    // First generate jeepney routes
    await this.generateCompleteRouteChain(dayPlan);
    
    // Then add Google directions for each route segment
    for (let i = 0; i < dayPlan.routes.length; i++) {
      const route = dayPlan.routes[i];
      
      // Create spot objects for the route
      const fromSpot = { 
        name: route.from, 
        location: route.startPoint 
      };
      const toSpot = { 
        name: route.to, 
        location: route.endPoint 
      };
      
      // Get Google directions for this segment
      const googleDirections = await this.getGoogleDirectionsForRoute(fromSpot, toSpot);
      
      // Add Google directions to the route
      route.googleDirections = googleDirections;
    }
  }
}
