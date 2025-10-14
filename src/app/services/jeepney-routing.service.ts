import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DirectionsService } from './directions.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class JeepneyRoutingService {

  constructor(
    private http: HttpClient,
    private directionsService: DirectionsService
  ) { }

  /**
   * Find jeepney route with waypoints
   */
  async findJeepneyRouteWithWaypoints(from: any, to: any): Promise<any> {
    try {
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;

      if (!fromLat || !fromLng || !toLat || !toLng) {
        return null;
      }

      // Check if coordinates are within Cebu bounds
      if (!this.isWithinCebu(fromLat, fromLng) || !this.isWithinCebu(toLat, toLng)) {
        return null;
      }

      const origin = `${fromLat},${fromLng}`;
      const destination = `${toLat},${toLng}`;

      // Use Google Maps Directions API with transit mode to get jeepney routes
      const response: any = await this.directionsService.getTransitRoute(origin, destination).toPromise();

      if (response && response.routes && response.routes.length > 0) {
        // Process all routes and find the best one with jeepney codes
        const processedRoutes = response.routes
          .map((route: any) => this.processGoogleMapsTransitRoute(route, from, to))
          .filter((route: any) => route && route.segments && route.segments.length > 0);

        if (processedRoutes.length > 0) {
          // Check if this route has any transit steps (jeepney routes)
          const bestRoute = processedRoutes[0];
          
          if (this.hasTransitSteps(bestRoute)) {
            // Process the route to check if it actually contains transit segments (jeepney or bus)
            return bestRoute;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding jeepney route:', error);
      return null;
    }
  }

  /**
   * Find multiple jeepney routes with waypoints
   */
  async findMultipleJeepneyRoutesWithWaypoints(from: any, to: any): Promise<any[]> {
    const routes: any[] = [];
    
    try {
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;

      if (!fromLat || !fromLng || !toLat || !toLng) {
        return routes;
      }

      // Check if coordinates are within Cebu bounds
      if (!this.isWithinCebu(fromLat, fromLng) || !this.isWithinCebu(toLat, toLng)) {
        return routes;
      }

      const origin = `${fromLat},${fromLng}`;
      const destination = `${toLat},${toLng}`;

      // Use Google Maps Directions API with transit mode to get jeepney routes
      const response: any = await this.directionsService.getTransitRoute(origin, destination).toPromise();

      if (response && response.routes && response.routes.length > 0) {
        // Process all routes and find the best ones with jeepney codes
        const processedRoutes = response.routes
          .map((route: any) => this.processGoogleMapsTransitRoute(route, from, to))
          .filter((route: any) => route && route.segments && route.segments.length > 0);

        for (const route of processedRoutes) {
          if (this.hasTransitSteps(route)) {
            routes.push(route);
          }
        }
      }

      // Sort routes by total score (lower is better) and return top 3
      return routes
        .sort((a, b) => {
          const scoreA = this.calculateRouteScore(a);
          const scoreB = this.calculateRouteScore(b);
          return scoreA - scoreB;
        })
        .slice(0, 3);

    } catch (error) {
      console.error('Error finding multiple jeepney routes:', error);
      return routes;
    }
  }

  /**
   * Process Google Maps transit route
   */
  private processGoogleMapsTransitRoute(route: any, from: any, to: any): any {
    if (!route.legs || route.legs.length === 0) {
      return null;
    }

    const leg = route.legs[0];
    const segments: any[] = [];
    let totalDuration = 0;
    let totalDistance = 0;

    if (leg.steps && leg.steps.length > 0) {
      for (const step of leg.steps) {
        const segment = this.processTransitStep(step);
        if (segment) {
          segments.push(segment);
          totalDuration += segment.duration;
          totalDistance += segment.distance;
        }
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
   * Process individual transit step
   */
  private processTransitStep(step: any): any {
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
        jeepneyCode: null,
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
   * Check if route has transit steps
   */
  private hasTransitSteps(route: any): boolean {
    if (!route || !route.segments) return false;
    
    return route.segments.some((segment: any) => 
      segment.type === 'jeepney' || segment.type === 'bus'
    );
  }

  /**
   * Calculate route score for sorting
   */
  private calculateRouteScore(route: any): number {
    if (!route) return Infinity;
    
    const duration = route.totalDuration || 0;
    const distance = route.totalDistance || 0;
    const jeepneySegments = route.segments?.filter((s: any) => s.type === 'jeepney').length || 0;
    
    // Lower score is better
    // Prefer routes with fewer transfers and shorter duration
    return duration + (jeepneySegments * 300); // Penalize transfers
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
   * Check if coordinates are within Cebu bounds
   */
  private isWithinCebu(lat: number, lng: number): boolean {
    // Cebu bounds: roughly 10.0-11.0 lat, 123.5-124.5 lng
    return lat >= 10.0 && lat <= 11.0 && lng >= 123.5 && lng <= 124.5;
  }

  /**
   * Find single ride route (no transfers)
   */
  async findSingleRideRoute(from: any, to: any): Promise<any> {
    try {
      const routes = await this.findMultipleJeepneyRoutesWithWaypoints(from, to);
      
      // Find routes with only one jeepney segment
      const singleRideRoutes = routes.filter(route => {
        const jeepneySegments = route.segments?.filter((s: any) => s.type === 'jeepney').length || 0;
        return jeepneySegments === 1;
      });

      return singleRideRoutes.length > 0 ? singleRideRoutes[0] : null;
    } catch (error) {
      console.error('Error finding single ride route:', error);
      return null;
    }
  }

  /**
   * Find multi-ride route (with transfers)
   */
  async findMultiRideRoute(from: any, to: any): Promise<any> {
    try {
      const routes = await this.findMultipleJeepneyRoutesWithWaypoints(from, to);
      
      // Find routes with multiple jeepney segments
      const multiRideRoutes = routes.filter(route => {
        const jeepneySegments = route.segments?.filter((s: any) => s.type === 'jeepney').length || 0;
        return jeepneySegments > 1;
      });

      return multiRideRoutes.length > 0 ? multiRideRoutes[0] : null;
    } catch (error) {
      console.error('Error finding multi-ride route:', error);
      return null;
    }
  }

  /**
   * Get route distance between two points
   */
  getRouteDistanceFromPoints(route: any, fromPoint: any, toPoint: any): number {
    if (!route || !route.segments) return 0;
    
    let totalDistance = 0;
    let foundStart = false;
    
    for (const segment of route.segments) {
      if (!foundStart) {
        // Check if this segment starts near the fromPoint
        const segmentStart = segment.from;
        const distanceToStart = this.calculateDistance(
          fromPoint.lat, fromPoint.lng,
          segmentStart.lat, segmentStart.lng
        );
        
        if (distanceToStart < 0.1) { // Within 100m
          foundStart = true;
        }
      }
      
      if (foundStart) {
        totalDistance += segment.distance || 0;
        
        // Check if this segment ends near the toPoint
        const segmentEnd = segment.to;
        const distanceToEnd = this.calculateDistance(
          toPoint.lat, toPoint.lng,
          segmentEnd.lat, segmentEnd.lng
        );
        
        if (distanceToEnd < 0.1) { // Within 100m
          break;
        }
      }
    }
    
    return totalDistance;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

