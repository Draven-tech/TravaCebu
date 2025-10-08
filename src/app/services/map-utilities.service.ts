import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapUtilitiesService {

  constructor() { }


///////////////////////////////// loadAvailableItineraries///////////////////////////////////////// 


    groupEventsIntoItineraries(events: any[]): any[] {
      if (!events || events.length === 0) return [];

      const itineraries: any[] = [];
      const groupedEvents = new Map<string, any[]>();
      
      // Load tourist spots from cache for location lookup
      let touristSpots: any[] = [];
      try {
        const cached = localStorage.getItem('tourist_spots_cache');
        if (cached) {
          touristSpots = JSON.parse(cached);
        }
      } catch (e) {
        // Silently handle cache errors
      }

      // Group events by date
      events.forEach(event => {
        const date = event.start.split('T')[0]; 
        if (!groupedEvents.has(date)) {
          groupedEvents.set(date, []);
        }
        groupedEvents.get(date)!.push(event);
      });

      // Convert grouped events to itineraries
      groupedEvents.forEach((dayEvents, date) => {
        if (dayEvents.length > 0) {
          // Sort events by start time
          dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          
          const firstEvent = dayEvents[0];
          const lastEvent = dayEvents[dayEvents.length - 1];
          
          const itinerary = {
            id: `itinerary_${date}`,
            name: `Itinerary for ${this.getDateDisplay(date)}`,
            start: firstEvent.start,
            end: lastEvent.end,
            date: date,
            status: firstEvent.status || 'active',
            days: [{
              day: 1,
              date: date,
              spots: dayEvents.map((event: any) => {
                // Try to get location from event first
                let location = event.extendedProps?.location || null;
                
                // If location is invalid or missing, try to find it in tourist spots
                if (!location || !location.lat || !location.lng || (location.lat === 0 && location.lng === 0)) {
                  const matchingSpot = touristSpots.find(spot => 
                    spot.name === event.title || 
                    spot.id === event.extendedProps?.spotId
                  );
                  if (matchingSpot && matchingSpot.location) {
                    location = matchingSpot.location;
                  } else {
                    location = null; // Set to null instead of {0,0}
                  }
                }
                
                // Determine the type of event (tourist spot, restaurant, or hotel)
                const eventType = event.extendedProps?.type || 'tourist_spot';
                let category = event.extendedProps?.category || 'GENERAL';
                let img = event.extendedProps?.img || 'assets/img/default.png';
                
                // Set appropriate category and image based on event type
                if (eventType === 'restaurant') {
                  category = 'Restaurant';
                  img = 'assets/img/restaurant-icon.png';
                } else if (eventType === 'hotel') {
                  category = 'Hotel';
                  img = 'assets/img/hotel-icon.png';
                }
                
                return {
                  id: event.extendedProps?.spotId || event.id || '',
                  name: event.title || 'Unknown Spot',
                  description: event.extendedProps?.description || '',
                  category: category,
                  timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
                  estimatedDuration: event.extendedProps?.duration || '2 hours',
                  durationMinutes: event.extendedProps?.durationMinutes || 120,
                  location: location, // Can be null if not found
                  img: img,
                  mealType: event.extendedProps?.mealType || null,
                  eventType: eventType,
                  // Add restaurant/hotel specific properties
                  restaurant: event.extendedProps?.restaurant || null,
                  hotel: event.extendedProps?.hotel || null,
                  rating: event.extendedProps?.rating || null,
                  vicinity: event.extendedProps?.vicinity || null
                };
              })
            }]
          };
          
          itineraries.push(itinerary);
        }
      });

      return itineraries;
    }

    ////////////////////////////////// loadItineraryRoutes /////////////////////////////////////////

  getDateDisplay(dateString: string): string {
    if (!dateString) return 'Unknown Date';
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown Date';
      }
      
      // Always return the full date format
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Unknown Date';
    }
  }



  /**
   * Generate nearby points around a location for route searching
   */
  generateNearbyPoints(lat: number, lng: number, radiusKm: number): any[] {
    const points: any[] = [];
    const numPoints = 8; // Generate 8 points in a circle
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 360) / numPoints;
      const distance = radiusKm / 111; // Rough conversion from km to degrees
      
      const newLat = lat + (distance * Math.cos(angle * Math.PI / 180));
      const newLng = lng + (distance * Math.sin(angle * Math.PI / 180));
      
      points.push({
        lat: newLat,
        lng: newLng
      });
    }
    
    return points;
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
   * Convert degrees to radians
   */
  deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Check if coordinates are within Cebu bounds
   */
  isWithinCebu(lat: number, lng: number): boolean {
    // Cebu bounds: roughly 10.0-11.0 lat, 123.5-124.5 lng
    return lat >= 10.0 && lat <= 11.0 && lng >= 123.5 && lng <= 124.5;
  }

  /**
   * Format distance in meters to readable format
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Format duration in seconds to readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format fare in cents to readable format
   */
  formatFare(cents: number): string {
    if (cents === 0) return 'Free';
    const pesos = cents / 100;
    return `₱${pesos.toFixed(2)}`;
  }

  /**
   * Decode OSRM polyline
   */
  decodeOSRMPolyline(encoded: string): any[] {
    if (!encoded) return [];
    
    const points: any[] = [];
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
   * Decode Google polyline
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
   * Extract route segments from route
   */
  extractRouteSegments(route: any): any[] {
    if (!route || !route.segments) return [];
    
    return route.segments.map((segment: any, index: number) => ({
      ...segment,
      index,
      instructions: this.generateSegmentInstructions(segment),
      transportMode: this.determineTransportMode(segment)
    }));
  }

  /**
   * Determine transport mode from segment
   */
  determineTransportMode(leg: any): string {
    if (leg.type === 'walk') return 'Walking';
    if (leg.type === 'jeepney') return 'Jeepney';
    if (leg.type === 'bus') return 'Bus';
    return 'Unknown';
  }

  /**
   * Generate segment instructions
   */
  generateSegmentInstructions(leg: any): string {
    if (leg.type === 'walk') {
      return `Walk ${this.formatDistance(leg.distance)} (${this.formatDuration(leg.duration)})`;
    } else if (leg.type === 'jeepney' || leg.type === 'bus') {
      return `Take ${leg.jeepneyCode || leg.type} for ${this.formatDistance(leg.distance)} (${this.formatDuration(leg.duration)})`;
    }
    return leg.description || 'Continue';
  }

  /**
   * Extract transit details from leg
   */
  extractTransitDetails(leg: any): any {
    if (leg.type !== 'jeepney' && leg.type !== 'bus') return null;
    
    return {
      line: leg.jeepneyCode,
      type: leg.type,
      duration: leg.duration,
      distance: leg.distance
    };
  }

  /**
   * Estimate fare for route
   */
  estimateFare(route: any): string {
    if (!route || !route.segments) return '₱0.00';
    
    let totalFare = 0;
    route.segments.forEach((segment: any) => {
      if (segment.type === 'jeepney') {
        totalFare += 12; // Standard jeepney fare in Cebu
      } else if (segment.type === 'bus') {
        totalFare += 15; // Standard bus fare
      }
    });
    
    return this.formatFare(totalFare * 100);
  }

  /**
   * Generate fallback routes when no transit is available
   */
  generateFallbackRoutes(origin: any, destination: any): any[] {
    const distance = this.calculateDistance(
      origin.lat || origin.location?.lat,
      origin.lng || origin.location?.lng,
      destination.lat || destination.location?.lat,
      destination.lng || destination.location?.lng
    );

    // If distance is less than 2km, suggest walking
    if (distance < 2) {
      return [{
        segments: [{
          type: 'walk',
          description: `Walk to ${destination.name}`,
          duration: Math.round(distance * 1000 / 1.1), // ~1.1 m/s walking speed
          distance: distance * 1000,
          from: origin,
          to: destination,
          jeepneyCode: null,
          polyline: null
        }],
        totalDuration: Math.round(distance * 1000 / 1.1),
        totalDistance: distance * 1000,
        summary: `Walking route: ${this.formatDistance(distance * 1000)} • ${this.formatDuration(Math.round(distance * 1000 / 1.1))}`
      }];
    }

    return [];
  }

  /**
   * Check if network is online
   */
  isOnline(): boolean {
    return window.navigator.onLine;
  }

  /**
   * Create bounds from coordinates
   */
  createBounds(coordinates: [number, number][]): any {
    if (!coordinates || coordinates.length === 0) return null;
    
    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];
    
    coordinates.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(lat: number, lng: number): boolean {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
  }

  /**
   * Snap coordinates to nearest valid point
   */
  snapCoordinates(lat: number, lng: number): { lat: number; lng: number } {
    return {
      lat: Math.max(-90, Math.min(90, lat)),
      lng: Math.max(-180, Math.min(180, lng))
    };
  }
}
