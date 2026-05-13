import { Injectable } from '@angular/core';
import { MapUtilitiesService } from './map-utilities.service';

export interface SegmentCoordinateContext {
  touristSpots: any[];
  /** Current calendar itinerary (days/spots), or null when none selected */
  selectedItinerary: any | null;
}

/**
 * Resolves a map center for a route segment (meal/hotel name matching, from/to shapes, polyline).
 */
@Injectable({
  providedIn: 'root',
})
export class SegmentCoordinateService {
  constructor(private mapUtils: MapUtilitiesService) {}

  resolveSegmentLatLng(segment: any, ctx: SegmentCoordinateContext): { lat: number; lng: number } | null {
    let lat: number | undefined;
    let lng: number | undefined;

    if (segment.type === 'meal' || segment.type === 'accommodation') {
      const placeName = segment.from || segment.to || segment.placeName;

      if (placeName && typeof placeName === 'string') {
        const cleanName = placeName.replace(/🍽️|🏨|🛏️/g, '').trim();

        const foundSpot = ctx.touristSpots.find(
          (spot) =>
            spot.name.toLowerCase().includes(cleanName.toLowerCase()) ||
            cleanName.toLowerCase().includes(spot.name.toLowerCase())
        );

        if (foundSpot && foundSpot.location) {
          lat = foundSpot.location.lat;
          lng = foundSpot.location.lng;
        }

        if (!lat && ctx.selectedItinerary?.days) {
          ctx.selectedItinerary.days.forEach((day: any) => {
            day.spots?.forEach((spot: any) => {
              if (
                spot.name.toLowerCase().includes(cleanName.toLowerCase()) ||
                (spot.chosenRestaurant &&
                  spot.chosenRestaurant.name.toLowerCase().includes(cleanName.toLowerCase())) ||
                (spot.chosenHotel && spot.chosenHotel.name.toLowerCase().includes(cleanName.toLowerCase()))
              ) {
                lat = spot.location?.lat;
                lng = spot.location?.lng;
              }
            });
          });
        }
      }
    }

    if (!lat || !lng) {
      if (segment.from && segment.from.lat && segment.from.lng) {
        lat = segment.from.lat;
        lng = segment.from.lng;
      } else if (segment.from && segment.from.location && segment.from.location.lat && segment.from.location.lng) {
        lat = segment.from.location.lat;
        lng = segment.from.location.lng;
      } else if (segment.fromLocation && segment.fromLocation.lat && segment.fromLocation.lng) {
        lat = segment.fromLocation.lat;
        lng = segment.fromLocation.lng;
      } else if (segment.to && segment.to.lat && segment.to.lng) {
        lat = segment.to.lat;
        lng = segment.to.lng;
      } else if (segment.to && segment.to.location && segment.to.location.lat && segment.to.location.lng) {
        lat = segment.to.location.lat;
        lng = segment.to.location.lng;
      } else if (segment.toLocation && segment.toLocation.lat && segment.toLocation.lng) {
        lat = segment.toLocation.lat;
        lng = segment.toLocation.lng;
      } else if (segment.polyline) {
        try {
          let decodedPoints: [number, number][] = [];

          if (typeof segment.polyline === 'string') {
            decodedPoints = this.mapUtils.decodePolyline(segment.polyline);
          } else if (segment.polyline.points) {
            decodedPoints = this.mapUtils.decodePolyline(segment.polyline.points);
          } else if (Array.isArray(segment.polyline) && segment.polyline.length > 0) {
            lat = segment.polyline[0].lat;
            lng = segment.polyline[0].lng;
          }

          if (!lat && decodedPoints.length > 0) {
            lat = decodedPoints[0][0];
            lng = decodedPoints[0][1];
          }
        } catch {
          // ignore decode errors
        }
      }
    }

    if (lat != null && lng != null && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
    return null;
  }
}
