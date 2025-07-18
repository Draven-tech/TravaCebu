import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DirectionsService } from './directions.service';
import { ApiTrackerService } from './api-tracker.service';
import { PlacesService } from './places.service';

@Injectable({ providedIn: 'root' })
export class ItineraryService {
  constructor(
    private firestore: AngularFirestore,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private placesService: PlacesService
  ) {}

  // Generate an itinerary given a list of spot IDs and number of days
  async generateItinerary(spotIds: string[], numDays: number): Promise<any[]> {
    // 1. Distribute spots across days
    const days: any[] = Array.from({ length: numDays }, () => []);
    spotIds.forEach((spotId, i) => {
      days[i % numDays].push(spotId);
    });

    // 2. For each day, build routes between consecutive spots (curated only)
    const itinerary: any[] = [];
    for (let day = 0; day < days.length; day++) {
      const daySpots = days[day];
      const dayPlan: any = { spots: [], routes: [], restaurants: [], hotels: [] };
      for (let i = 0; i < daySpots.length; i++) {
        // Fetch spot data
        const spotDoc = await this.firestore.collection('tourist_spots').doc(daySpots[i]).get().toPromise();
        const spotData = { id: daySpots[i], ...(spotDoc?.data() || {}) } as { id: any; location: { lat: number; lng: number } };
        dayPlan.spots.push(spotData);
        // Fetch restaurants near each spot
        const restRes: any = await this.placesService.getNearbyPlaces(spotData.location.lat, spotData.location.lng, 'restaurant').toPromise();
        dayPlan.restaurants.push({ spotId: spotData.id, results: restRes.results || [] });
        // If not the first spot, find curated route from previous spot
        if (i > 0) {
          const fromSpot = dayPlan.spots[i - 1];
          const toSpot = dayPlan.spots[i];
          // Try to find a jeepney route in Firestore
          const routeSnap = await this.firestore.collection('jeepney_routes', ref =>
            ref.where('start', '==', fromSpot.location).where('end', '==', toSpot.location)
          ).get().toPromise();
          if (routeSnap && !routeSnap.empty) {
            // Use local jeepney route
            dayPlan.routes.push({
              type: 'jeepney',
              ...(routeSnap.docs[0].data() || {})
            });
          } else {
            // No curated route found
            dayPlan.routes.push({ type: 'none', message: 'No curated jeepney route found' });
          }
        }
      }
      // Fetch hotels near the last spot of the day
      if (dayPlan.spots.length > 0) {
        const lastSpot = dayPlan.spots[dayPlan.spots.length - 1];
        const hotelRes: any = await this.placesService.getNearbyPlaces(lastSpot.location.lat, lastSpot.location.lng, 'lodging').toPromise();
        dayPlan.hotels = hotelRes.results || [];
      }
      itinerary.push(dayPlan);
    }
    return itinerary;
  }

  // Fetch Directions API route on demand for a given segment
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
      // Parse transit details (bus/jeepney)
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
} 