import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Geolocation } from '@capacitor/geolocation';
import { ApiTrackerService } from './api-tracker.service';
import { DirectionsService } from './directions.service';

export interface RouteSegment {
  from: string;
  to: string;
  jeepneyCode?: string;
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  estimatedTime: string;
  type: 'user_to_spot' | 'spot_to_restaurant' | 'restaurant_to_spot' | 'spot_to_spot' | 'spot_to_hotel';
  description: string;
  mealType?: string;
  googleDirections?: any;
}

export interface CompleteRoute {
  day: number;
  segments: RouteSegment[];
  totalDuration: string;
  totalDistance: string;
}

@Injectable({
  providedIn: 'root'
})
export class RouteManagerService {

  constructor(
    private firestore: AngularFirestore,
    private apiTracker: ApiTrackerService,
    private directionsService: DirectionsService
  ) {}

  // Get user's current location with fallback
  async getUserLocation(): Promise<{ lat: number; lng: number }> {
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

  // Find jeepney route between two points
  async findJeepneyRoute(fromPoint: { lat: number; lng: number }, toPoint: { lat: number; lng: number }): Promise<any> {
    try {
      // Find jeepney routes that pass through the destination
      const routesSnap = await this.firestore.collection('jeepney_routes', ref =>
        ref.where('points', 'array-contains', { lat: toPoint.lat, lng: toPoint.lng })
      ).get().toPromise();

      if (!routesSnap || routesSnap.empty) {
        return null;
      }

      let bestRoute: any = null;
      let minDistance = Infinity;

      // Find the route that has the closest start point to the fromPoint
      for (const doc of routesSnap.docs) {
        const route = doc.data() as any;
        if (!route.points || route.points.length < 2) continue;

        // Find the closest point in the route to fromPoint
        let closestPoint = route.points[0];
        let minDist = this.getDistance(fromPoint, closestPoint);

        for (const point of route.points) {
          const dist = this.getDistance(fromPoint, point);
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
            endPoint: toPoint,
            estimatedTime: this.calculateJeepneyTime(route.points, closestPoint, toPoint),
            points: route.points
          };
        }
      }

      return bestRoute;
    } catch (error) {
      console.error('Error finding jeepney route:', error);
      return null;
    }
  }

  // Calculate distance between two points using Haversine formula
  private getDistance(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
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

  // Get Google Directions for a route segment
  async getGoogleDirections(fromPoint: { lat: number; lng: number }, toPoint: { lat: number; lng: number }): Promise<any> {
    const canCall = await this.apiTracker.canCallApiToday('directions', 100);
    if (!canCall) {
      return { type: 'limit', message: 'API limit reached' };
    }
    
    this.apiTracker.logApiCall('directions', 'route', { from: fromPoint, to: toPoint });
    
    try {
      const result: any = await this.directionsService.getTransitRoute(
        `${fromPoint.lat},${fromPoint.lng}`,
        `${toPoint.lat},${toPoint.lng}`
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

  // Generate complete route for a day
  async generateCompleteRoute(dayPlan: any): Promise<CompleteRoute> {
    const segments: RouteSegment[] = [];
    const userLocation = await this.getUserLocation();
    
    // Route from user location to first spot
    if (dayPlan.spots.length > 0) {
      const firstSpot = dayPlan.spots[0];
      const routeToFirst = await this.findJeepneyRoute(userLocation, firstSpot.location);
      
      if (routeToFirst) {
        segments.push({
          from: 'Your Location',
          to: firstSpot.name,
          jeepneyCode: routeToFirst.code,
          startPoint: routeToFirst.startPoint,
          endPoint: routeToFirst.endPoint,
          estimatedTime: routeToFirst.estimatedTime,
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
          currentSpot.location,
          currentSpot.chosenRestaurant.location
        );
        
        if (routeToRestaurant) {
          segments.push({
            from: currentSpot.name,
            to: currentSpot.chosenRestaurant.name,
            jeepneyCode: routeToRestaurant.code,
            startPoint: routeToRestaurant.startPoint,
            endPoint: routeToRestaurant.endPoint,
            estimatedTime: routeToRestaurant.estimatedTime,
            type: 'spot_to_restaurant',
            mealType: currentSpot.mealType,
            description: `From ${currentSpot.name} to ${currentSpot.chosenRestaurant.name} for ${currentSpot.mealType}`
          });
        }
        
        // Route from restaurant to next spot
        if (nextSpot) {
          const routeFromRestaurant = await this.findJeepneyRoute(
            currentSpot.chosenRestaurant.location,
            nextSpot.location
          );
          
          if (routeFromRestaurant) {
            segments.push({
              from: currentSpot.chosenRestaurant.name,
              to: nextSpot.name,
              jeepneyCode: routeFromRestaurant.code,
              startPoint: routeFromRestaurant.startPoint,
              endPoint: routeFromRestaurant.endPoint,
              estimatedTime: routeFromRestaurant.estimatedTime,
              type: 'restaurant_to_spot',
              description: `From ${currentSpot.chosenRestaurant.name} to ${nextSpot.name}`
            });
          }
        }
      } else if (nextSpot) {
        // Direct route from current spot to next spot
        const routeToNext = await this.findJeepneyRoute(currentSpot.location, nextSpot.location);
        
        if (routeToNext) {
          segments.push({
            from: currentSpot.name,
            to: nextSpot.name,
            jeepneyCode: routeToNext.code,
            startPoint: routeToNext.startPoint,
            endPoint: routeToNext.endPoint,
            estimatedTime: routeToNext.estimatedTime,
            type: 'spot_to_spot',
            description: `From ${currentSpot.name} to ${nextSpot.name}`
          });
        }
      }
    }
    
    // Route from last spot to hotel
    if (dayPlan.chosenHotel && dayPlan.chosenHotel.location && dayPlan.spots.length > 0) {
      const lastSpot = dayPlan.spots[dayPlan.spots.length - 1];
      const routeToHotel = await this.findJeepneyRoute(
        lastSpot.location,
        dayPlan.chosenHotel.location
      );
      
      if (routeToHotel) {
        segments.push({
          from: lastSpot.name,
          to: dayPlan.chosenHotel.name,
          jeepneyCode: routeToHotel.code,
          startPoint: routeToHotel.startPoint,
          endPoint: routeToHotel.endPoint,
          estimatedTime: routeToHotel.estimatedTime,
          type: 'spot_to_hotel',
          description: `From ${lastSpot.name} to ${dayPlan.chosenHotel.name} for check-in`
        });
      }
    }
    
    // Add Google directions to each segment
    for (const segment of segments) {
      segment.googleDirections = await this.getGoogleDirections(segment.startPoint, segment.endPoint);
    }
    
    // Calculate totals
    const totalDuration = this.calculateTotalDuration(segments);
    const totalDistance = this.calculateTotalDistance(segments);
    
    return {
      day: dayPlan.day,
      segments,
      totalDuration,
      totalDistance
    };
  }

  // Calculate total duration from segments
  private calculateTotalDuration(segments: RouteSegment[]): string {
    let totalMinutes = 0;
    
    for (const segment of segments) {
      const timeStr = segment.estimatedTime;
      const match = timeStr.match(/(\d+)/);
      if (match) {
        totalMinutes += parseInt(match[1]);
      }
    }
    
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  // Calculate total distance from segments
  private calculateTotalDistance(segments: RouteSegment[]): string {
    let totalMeters = 0;
    
    for (const segment of segments) {
      totalMeters += this.getDistance(segment.startPoint, segment.endPoint);
    }
    
    if (totalMeters < 1000) {
      return `${Math.round(totalMeters)}m`;
    } else {
      return `${(totalMeters / 1000).toFixed(1)}km`;
    }
  }
}
