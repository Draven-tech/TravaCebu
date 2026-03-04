import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DirectionsService } from './directions.service';
import { ApiTrackerService } from './api-tracker.service';
import { PlacesService } from './places.service';
import { Geolocation } from '@capacitor/geolocation';

export interface ItinerarySpot {
  id: string;
  touristSpotId?: string;
  spotId?: string;
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
  date?: string;
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

    const normalizedSpots = (spots || [])
      .map(spot => this.normalizeSpotWithId(spot))
      .filter((spot): spot is any => !!spot);

    if (normalizedSpots.length === 0) {
      console.warn('[ItineraryService] No valid tourist spots with Firestore IDs were provided. Aborting itinerary generation.');
      return [];
    }

    const sortedSpots = this.sortSpotsByProximity(normalizedSpots);
    const days: any[] = Array.from({ length: numDays }, () => []);
    sortedSpots.forEach((spot, i) => {
      days[i % numDays].push(spot);
    });
    
    const itinerary: ItineraryDay[] = [];
    
    for (let day = 0; day < days.length; day++) {
      const daySpots = days[day];
      if (daySpots.length === 0) continue;
      
      const dayPlan: ItineraryDay = { day: day + 1, spots: [], routes: [] };
      
      if (startDate) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + day);
        dayPlan.date = dayDate.toISOString().split('T')[0];
      }
      
      const totalSpots = daySpots.length;
      const start = this.parseTime(startTime, startDate);
      const end = this.parseTime(endTime, startDate);
      const totalMinutes = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60));
      const slotMinutes = Math.max(30, Math.floor(totalMinutes / totalSpots)); 
      
      let currentTime = new Date(start);
      
      for (let i = 0; i < daySpots.length; i++) {
        const spotData = daySpots[i];
        const canonicalSpotId = spotData?.touristSpotId || spotData?.spotId || spotData?.id;

        if (!canonicalSpotId) {
          console.warn('[ItineraryService] Skipping itinerary spot without a Firestore ID.', spotData);
          continue;
        }

        const normalizedSpotData = {
          ...spotData,
          id: canonicalSpotId,
          touristSpotId: canonicalSpotId,
          spotId: canonicalSpotId
        };

        const timeSlot = this.formatTime(currentTime);
        const estimatedDuration = `${slotMinutes} min`;
        const mealType = this.getMealType(currentTime);
        
        dayPlan.spots.push({
          ...normalizedSpotData,
          timeSlot,
          estimatedDuration,
          mealType,
          durationMinutes: slotMinutes
        });
        
        currentTime = new Date(currentTime.getTime() + slotMinutes * 60000);

        if (i === daySpots.length - 1) {
          await this.generateCompleteRouteChain(dayPlan);
        }
      }
      
      itinerary.push(dayPlan);
    }
    
    return itinerary;
  }

  async fetchSuggestionsForItinerary(itinerary: ItineraryDay[], logFn?: (msg: string) => void): Promise<ItineraryDay[]> {

    for (const day of itinerary) {
      for (const spot of day.spots) {
        if (spot.mealType) {
          try {
            const restRes: any = await this.placesService.getNearbyPlaces(spot.location.lat, spot.location.lng, 'restaurant').toPromise();
            const suggestions = restRes.results || [];
            spot.restaurantSuggestions = this.rankPlacesByQualityAndProximity(suggestions, spot.location);
          } catch (error) {
            console.error(`Error fetching restaurants for ${spot.name}:`, error);
            spot.restaurantSuggestions = [];
          }
        }
      }
      
      if (day.spots.length > 0) {
        const lastSpot = day.spots[day.spots.length - 1];
        try {
          const hotelRes: any = await this.placesService.getNearbyPlaces(lastSpot.location.lat, lastSpot.location.lng, 'lodging').toPromise();
          const suggestions = hotelRes.results || [];
          day.hotelSuggestions = this.rankPlacesByQualityAndProximity(suggestions, lastSpot.location);
        } catch (error) {
          console.error(`Error fetching hotels for Day ${day.day}:`, error);
          day.hotelSuggestions = [];
        }
      }
    }
    
    return itinerary;
  }

  private rankPlacesByQualityAndProximity(places: any[], origin: { lat: number; lng: number }): any[] {
    if (!Array.isArray(places) || places.length === 0) {
      return [];
    }

    const locations = places
      .map(p => this.safeGetPlaceLocation(p))
      .filter((loc): loc is { lat: number; lng: number } => !!loc);
    const distances = locations.map(loc => this.getDistance(origin, loc));
    const maxDistanceKm = Math.max(5, distances.length ? Math.max(...distances) : 0);

    const scored = places.map((place) => {
      const rating: number = typeof place.rating === 'number' ? place.rating : 0;
      const reviews: number = typeof place.user_ratings_total === 'number' ? place.user_ratings_total : 0;
      const openNow: boolean = !!place.opening_hours?.open_now;
      const priceLevel: number = typeof place.price_level === 'number' ? place.price_level : 2; 
      const loc = this.safeGetPlaceLocation(place);
      const distanceKm = loc ? this.getDistance(origin, loc) : maxDistanceKm;

      const ratingScore = rating / 5; // 0..1
      const reviewsScore = Math.min(1, Math.log10(Math.max(1, reviews)) / 3); 
      const proximityScore = 1 - Math.min(1, distanceKm / maxDistanceKm);
      const openNowBonus = openNow ? 0.08 : 0;
      const priceScore = 1 - Math.min(1, priceLevel / 4);

      const score = (
        0.45 * ratingScore +
        0.25 * reviewsScore +
        0.20 * proximityScore +
        0.07 * priceScore +
        openNowBonus
      );

      return { place, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.place);
  }

  private safeGetPlaceLocation(place: any): { lat: number; lng: number } | null {
    const lat = place?.geometry?.location?.lat;
    const lng = place?.geometry?.location?.lng;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return null;
  }

  private getCacheKey(itinerary: ItineraryDay[]): string {
    const key = itinerary.map(day => day.spots.map(s => s.id).join('-')).join('|');
    return 'itinerary_suggestions_' + key;
  }

  private parseTime(time: string, startDate?: string): Date {
    const [h, m] = time.split(':').map(Number);
    let d: Date;
    
    if (startDate) {
      d = new Date(startDate);
      d.setHours(h, m, 0, 0);
    } else {
      d = new Date();
      d.setHours(h, m, 0, 0);
    }
    
    if (isNaN(d.getTime())) {
      console.warn('Invalid date created, using current date as fallback');
      d = new Date();
      d.setHours(h, m, 0, 0);
    }
    
    return d;
  }

  private formatTime(date: Date): string {
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

  async testApiConnection(): Promise<any> {
    try {
      const testResult = await this.placesService.testApiKey().toPromise();
      return testResult;
    } catch (error) {
      console.error('API connection test error:', error);
      return { status: 'ERROR', error: (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error) };
    }
  }

  updateTimeSlots(day: ItineraryDay, startTime: string = '08:00'): void {
    if (!day.spots || day.spots.length === 0) return;

    let currentTime = this.parseTime(startTime);
    
    for (let i = 0; i < day.spots.length; i++) {
      const spot = day.spots[i];
      
      if (!spot.customTime) {
        spot.timeSlot = this.formatTime(currentTime);
      }
      
      const durationMinutes = spot.durationMinutes || 120;
      const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      spot.estimatedDuration = `${durationMinutes} min`;
      
      currentTime = endTime;
    }
  }

  private async findJeepneyRoute(fromSpot: ItinerarySpot, toSpot: ItinerarySpot): Promise<any> {
    try {
      const routesSnap = await this.firestore.collection('jeepney_routes', ref =>
        ref.where('points', 'array-contains', { lat: toSpot.location.lat, lng: toSpot.location.lng })
      ).get().toPromise();

      if (!routesSnap || routesSnap.empty) {
        return null;
      }

      let bestRoute: any = null;
      let minDistance = Infinity;

      for (const doc of routesSnap.docs) {
        const route = doc.data() as any;
        if (!route.points || route.points.length < 2) continue;

        let closestPoint = route.points[0];
        let minDist = this.getDistance(fromSpot.location, closestPoint);

        for (const point of route.points) {
          const dist = this.getDistance(fromSpot.location, point);
          if (dist < minDist) {
            minDist = dist;
            closestPoint = point;
          }
        }

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

  private getDistance(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
    const R = 6371;
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

  private normalizeSpotWithId(spot: any): any | null {
    if (!spot) {
      return null;
    }

    const canonicalSpotId = spot.touristSpotId || spot.spotId || spot.id;

    if (!canonicalSpotId) {
      console.warn('[ItineraryService] Encountered a spot without a Firestore document ID. Spot will be ignored for itinerary generation.', spot);
      return null;
    }

    return {
      ...spot,
      id: canonicalSpotId,
      touristSpotId: canonicalSpotId,
      spotId: canonicalSpotId
    };
  }

  private sortSpotsByProximity(spots: any[]): any[] {
    if (spots.length <= 1) {
      return spots;
    }

    const validSpots = spots.filter(spot => 
      spot.location && 
      typeof spot.location.lat === 'number' && 
      typeof spot.location.lng === 'number' &&
      !isNaN(spot.location.lat) && 
      !isNaN(spot.location.lng)
    );

    if (validSpots.length <= 1) {
      return spots;
    }

    const sortedSpots = [...validSpots];
    const result: any[] = [];
    const unvisited = new Set(sortedSpots.map((_, index) => index));
    
    const avgLat = sortedSpots.reduce((sum, spot) => sum + spot.location.lat, 0) / sortedSpots.length;
    const avgLng = sortedSpots.reduce((sum, spot) => sum + spot.location.lng, 0) / sortedSpots.length;
    
    let currentIndex = 0;
    let minDistanceToCenter = Infinity;
    
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
        for (const index of unvisited) {
          result.push(sortedSpots[index]);
        }
        break;
      }
    }

    const invalidSpots = spots.filter(spot => 
      !spot.location || 
      typeof spot.location.lat !== 'number' || 
      typeof spot.location.lng !== 'number' ||
      isNaN(spot.location.lat) || 
      isNaN(spot.location.lng)
    );
    
    return [...result, ...invalidSpots];
  }

  private calculateJeepneyTime(routePoints: any[], startPoint: any, endPoint: any): string {
    let startIndex = 0;
    let endIndex = routePoints.length - 1;

    for (let i = 0; i < routePoints.length; i++) {
      if (this.getDistance(routePoints[i], startPoint) < 0.1) { 
        startIndex = i;
      }
      if (this.getDistance(routePoints[i], endPoint) < 0.1) {
        endIndex = i;
      }
    }

    const distance = Math.abs(endIndex - startIndex) * 0.5;
    const timeMinutes = Math.max(10, Math.round(distance * 2));

    return `${timeMinutes} min`;
  }

  async generateCompleteRouteChain(dayPlan: ItineraryDay): Promise<void> {
    const routeChain: any[] = [];
    
    const userLocation = await this.getUserLocation();
    
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
    
    for (let i = 0; i < dayPlan.spots.length; i++) {
      const currentSpot = dayPlan.spots[i];
      const nextSpot = dayPlan.spots[i + 1];

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
    
    dayPlan.routes = routeChain;
  }

  private async getUserLocation(): Promise<{ lat: number; lng: number }> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      });
      
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (error) {
      console.warn('Could not get user location, using default Cebu City center:', error);
      return { lat: 10.3157, lng: 123.8854 };
    }
  }

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

  async generateCompleteRouteInfo(dayPlan: ItineraryDay): Promise<void> {
    await this.generateCompleteRouteChain(dayPlan);
    
    for (let i = 0; i < dayPlan.routes.length; i++) {
      const route = dayPlan.routes[i];
      
      const fromSpot = { 
        name: route.from, 
        location: route.startPoint 
      };
      const toSpot = { 
        name: route.to, 
        location: route.endPoint 
      };
      const googleDirections = await this.getGoogleDirectionsForRoute(fromSpot, toSpot);
      route.googleDirections = googleDirections;
    }
  }
}
