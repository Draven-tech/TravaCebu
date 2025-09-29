import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DirectionsService } from './directions.service';
import { environment } from '../../environments/environment';
import * as L from 'leaflet';

export interface RouteSegment {
  type: 'walk' | 'jeepney' | 'bus';
  description: string;
  duration: number;
  distance: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  jeepneyCode?: string;
  polyline?: string;
  instructions?: string;
  estimatedTime?: string;
  stage?: number;
}

export interface RouteInfo {
  segments: RouteSegment[];
  totalDuration: number;
  totalDistance: number;
  totalFare?: string;
  summary: string;
  suggestedRoutes?: any[];
  selectedRouteIndex?: number;
}

@Injectable({
  providedIn: 'root'
})
export class RoutePlanningService {

  constructor(
    private http: HttpClient,
    private directionsService: DirectionsService
  ) { }

  /**
   * Generate route information from itinerary using stage-based Google Maps API routing
   */
  async generateRouteInfoFromItinerary(itinerary: any[], userLocation: any): Promise<RouteInfo> {
    const segments: RouteSegment[] = [];
    let totalDuration = 0;
    let totalDistance = 0;

    for (let i = 0; i < itinerary.length; i++) {
      const currentSpot = itinerary[i];
      const nextSpot = itinerary[i + 1];
      
      const from = i === 0 ? userLocation : itinerary[i - 1];
      const to = currentSpot;

      try {
        // Get all available transit routes (jeepney and bus) for this stage using Google Maps API
        const routes = await this.directionsService.getTransitRoute(
          `${from.lat || from.location?.lat},${from.lng || from.location?.lng}`,
          `${to.lat || to.location?.lat},${to.lng || to.location?.lng}`
        ).toPromise();

        if (routes && (routes as any).routes && (routes as any).routes.length > 0) {
          // Sort routes by duration to ensure consistency
          (routes as any).routes.sort((a: any, b: any) => a.legs[0].duration.value - b.legs[0].duration.value);
          
          // Use the first (best) route for the main segments display
          const bestRoute = (routes as any).routes[0];
          
          // Add segments from the best route
          const routeSegments = this.processGoogleMapsTransitRoute(bestRoute, from, to);
          segments.push(...routeSegments);
          
          // Update totals
          routeSegments.forEach(segment => {
            totalDuration += segment.duration;
            totalDistance += segment.distance;
          });
        } else {
          // No transit route found - add fallback message instead of creating walking segment
          segments.push({
            type: 'walk',
            description: `⚠️ No transit data available for this segment`,
            duration: 0,
            distance: 0,
            from: { lat: from.lat || from.location?.lat, lng: from.lng || from.location?.lng },
            to: { lat: to.lat || to.location?.lat, lng: to.lng || to.location?.lng },
            jeepneyCode: undefined,
            polyline: undefined
          });
        }
      } catch (error) {
        console.error('Error generating route for stage:', error);
        // Add error segment
        segments.push({
          type: 'walk',
          description: `Error generating route for this segment`,
          duration: 0,
          distance: 0,
          from: { lat: from.lat || from.location?.lat, lng: from.lng || from.location?.lng },
          to: { lat: to.lat || to.location?.lat, lng: to.lng || to.location?.lng },
          jeepneyCode: undefined,
          polyline: undefined
        });
      }
    }

    return {
      segments,
      totalDuration,
      totalDistance,
      summary: this.generateRouteSummary({ segments, totalDuration, totalDistance })
    };
  }

  /**
   * Process Google Maps transit route and extract segments
   */
  private processGoogleMapsTransitRoute(route: any, from: any, to: any): RouteSegment[] {
    const segments: RouteSegment[] = [];
    
    if (!route.legs || route.legs.length === 0) {
      return segments;
    }

    const leg = route.legs[0];
    
    if (!leg.steps || leg.steps.length === 0) {
      return segments;
    }

    for (const step of leg.steps) {
      const segment = this.processTransitStep(step);
      if (segment) {
        segments.push(segment);
      }
    }

    return segments;
  }

  /**
   * Process individual transit step
   */
  private processTransitStep(step: any): RouteSegment | null {
    if (!step) return null;

    const travelMode = step.travel_mode;
    
    if (travelMode === 'WALKING') {
      return {
        type: 'walk',
        description: step.html_instructions?.replace(/<[^>]*>/g, '') || 'Walk',
        duration: step.duration?.value || 0,
        distance: step.distance?.value || 0,
        from: {
          lat: step.start_location?.lat || 0,
          lng: step.start_location?.lng || 0
        },
        to: {
          lat: step.end_location?.lat || 0,
          lng: step.end_location?.lng || 0
        },
        jeepneyCode: undefined,
        polyline: step.polyline?.points || null
      };
    } else if (travelMode === 'TRANSIT') {
      const transitDetails = step.transit_details;
      if (transitDetails) {
        const line = transitDetails.line;
        const jeepneyCode = this.extractCebuJeepneyCodeFromRoutesAPI(line);
        
        return {
          type: this.isActualBus(line) ? 'bus' : 'jeepney',
          description: `${jeepneyCode || 'Transit'} - ${step.html_instructions?.replace(/<[^>]*>/g, '') || 'Transit'}`,
          duration: step.duration?.value || 0,
          distance: step.distance?.value || 0,
          from: {
            lat: step.start_location?.lat || 0,
            lng: step.start_location?.lng || 0
          },
          to: {
            lat: step.end_location?.lat || 0,
            lng: step.end_location?.lng || 0
          },
          jeepneyCode: jeepneyCode,
          polyline: step.polyline?.points || null
        };
      }
    }

    return null;
  }

  /**
   * Extract Cebu jeepney code from Google Routes API line information
   */
  private extractCebuJeepneyCodeFromRoutesAPI(transitLine: any): string {
    if (!transitLine) return '';

    // Try to extract jeepney code from various line properties
    const name = transitLine.name || '';
    const shortName = transitLine.short_name || '';
    
    // Try to extract code from name (e.g., "Route 12A" -> "12A")
    const nameMatch = name.match(/(\d+[A-Z]?)/i);
    if (nameMatch) {
      return nameMatch[1].toUpperCase();
    }
    
    // Try short name
    if (shortName) {
      return shortName.toUpperCase();
    }
    
    return name || 'Unknown';
  }

  /**
   * Check if this is an actual bus (not jeepney)
   */
  private isActualBus(line: any): boolean {
    if (!line) return false;
    
    const name = (line.name || '').toLowerCase();
    const shortName = (line.short_name || '').toLowerCase();
    
    // Check for bus indicators
    const busIndicators = ['bus', 'buses', 'bmc', 'city bus', 'provincial bus'];
    
    return busIndicators.some(indicator => 
      name.includes(indicator) || shortName.includes(indicator)
    );
  }

  /**
   * Generate route summary
   */
  private generateRouteSummary(route: any): string {
    const segments = route.segments || [];
    const totalDuration = route.totalDuration || 0;
    const totalDistance = route.totalDistance || 0;
    
    const jeepneySegments = segments.filter((s: any) => s.type === 'jeepney');
    const walkingSegments = segments.filter((s: any) => s.type === 'walk');
    
    let summary = `Total: ${this.formatDistance(totalDistance)} • ${this.formatDuration(totalDuration)}`;
    
    if (jeepneySegments.length > 0) {
      summary += ` • ${jeepneySegments.length} jeepney ride${jeepneySegments.length > 1 ? 's' : ''}`;
    }
    
    if (walkingSegments.length > 0) {
      summary += ` • ${walkingSegments.length} walk${walkingSegments.length > 1 ? 's' : ''}`;
    }
    
    return summary;
  }

  /**
   * Format distance in meters to readable format
   */
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Format duration in seconds to readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Decode polyline string to coordinates
   */
  decodePolyline(encoded: string): [number, number][] {
    if (!encoded) return [];
    
    const points: [number, number][] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  /**
   * Check if coordinates are within Cebu bounds
   */
  isWithinCebu(lat: number, lng: number): boolean {
    // Cebu bounds: roughly 10.0-11.0 lat, 123.5-124.5 lng
    return lat >= 10.0 && lat <= 11.0 && lng >= 123.5 && lng <= 124.5;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  /**
   * Generate route information from itinerary using stage-based Google Maps API routing
   * This is the main method that handles complex itinerary route generation
   */
  async generateRouteInfo(itinerary: any, userLocation: any, loadingCallback?: (message: string) => Promise<void>): Promise<any> {
    // Generate route information from itinerary using stage-based Google Maps API routing
    if (!itinerary || !itinerary.days) {
      return null;
    }

    try {
      const segments: any[] = [];
      let totalDuration = 0;
      let totalDistance = 0;
      let allSpots: any[] = []; // Collect all spots from all days

      for (const day of itinerary.days) {
        // Handle different spot data structures
        let spots = [];
        if (day.spots) {
          if (Array.isArray(day.spots)) {
            spots = day.spots;
          } else if (typeof day.spots === 'object') {
            // If spots is an object, convert it to array
            spots = Object.values(day.spots);
          } else {
            spots = [day.spots];
          }
        }
        
        // Add spots from this day to the collection
        allSpots = allSpots.concat(spots);
        
        // Create stages for consecutive spots
        for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
          const spot = spots[spotIndex];
          if (!spot || !spot.name) continue;
          
          // Determine the starting point for this stage
          let fromPoint;
          if (spotIndex === 0) {
            // First spot: start from user location
            fromPoint = userLocation;
          } else {
            // Subsequent spots: start from previous spot
            fromPoint = spots[spotIndex - 1];
          }
          
          // Validate fromPoint has coordinates (handle both user location and spot objects)
          const fromLat = fromPoint?.lat || fromPoint?.location?.lat;
          const fromLng = fromPoint?.lng || fromPoint?.location?.lng;
          if (!fromPoint || !fromLat || !fromLng) {
            console.warn(`⚠️ Stage ${spotIndex + 1}: Invalid fromPoint coordinates:`, fromPoint);
            continue;
          }
          
          // Validate spot has coordinates
          if (!spot.location || !spot.location.lat || !spot.location.lng) {
            console.warn(`⚠️ Stage ${spotIndex + 1}: Invalid spot coordinates:`, spot);
            continue;
          }
          
          // Update loading progress
          if (loadingCallback) {
            await loadingCallback(`🔍 Finding routes for Stage ${spotIndex + 1}: ${spot.name}`);
          }
          
          // Get all available transit routes (jeepney and bus) for this stage using Google Maps API
          const allRoutes = await this.findAllJeepneyRoutes(fromPoint, spot);
          
          if (allRoutes && allRoutes.length > 0) {
            // Sort routes by duration to ensure consistency
            allRoutes.sort((a: any, b: any) => a.totalDuration - b.totalDuration);
            
            // Use the first (best) route for the main segments display
            const bestRoute = allRoutes[0];
            // Add segments from the best route
            bestRoute.segments.forEach((segment: any) => {
              const segmentToAdd = {
                type: segment.type,
                from: segment.from, // Keep original coordinate object
                to: segment.to, // Keep original coordinate object
                fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
                toName: spot.name,
                estimatedTime: this.formatDuration(segment.duration || 0),
                description: segment.description,
                jeepneyCode: segment.jeepneyCode || null,
                mealType: null,
                distance: segment.distance || 0,
                duration: segment.duration || 0,
                stage: spotIndex + 1,
                polyline: segment.polyline // Preserve polyline for accurate map drawing
              };
              segments.push(segmentToAdd);
              
              // Add to totals
              if (segment.distance) {
                totalDistance += segment.distance / 1000; // Convert to km
              }
              if (segment.duration) {
                totalDuration += segment.duration; // Already in seconds
              }
            });
          } else {
            // No transit route found - add fallback message
            segments.push({
              type: 'walk',
              from: fromPoint,
              to: spot,
              fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
              toName: spot.name,
              estimatedTime: 'N/A',
              description: `⚠️ No transit data available for this segment`,
              jeepneyCode: null,
              mealType: null,
              distance: 0,
              duration: 0,
              stage: spotIndex + 1,
              polyline: null
            });
          }
        }
      }

      // Generate route summary
      const summary = this.generateRouteSummary(segments);
      
      return {
        segments,
        totalDuration,
        totalDistance,
        summary,
        suggestedRoutes: [], // Will be populated by other methods
        selectedRouteIndex: 0
      };
      
    } catch (error) {
      console.error('Error generating route info:', error);
      return null;
    }
  }

  /**
   * Find all jeepney routes using Google Maps API
   */
  private async findAllJeepneyRoutes(from: any, to: any): Promise<any[]> {
    // This would need to be implemented with the complex logic from the original
    // For now, return empty array - this should be implemented properly
    return [];
  }


  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}
