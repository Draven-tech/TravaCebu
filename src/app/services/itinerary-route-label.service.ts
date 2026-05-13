import { Injectable } from '@angular/core';

/**
 * Display strings for itineraries and route segments (map + modals).
 */
@Injectable({
  providedIn: 'root',
})
export class ItineraryRouteLabelService {
  formatItineraryTitle(itinerary: any): string {
    if (!itinerary) {
      return 'Unknown Itinerary';
    }

    const dayCount = itinerary.days?.length || 0;
    const spotCount = itinerary.days?.[0]?.spots?.length || 0;

    if (itinerary.name && itinerary.name !== `Itinerary for Unknown Date`) {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }

    return `Itinerary for Unknown Date (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
  }

  /** Short heading for completion modal: user itinerary name only. */
  getItineraryCompletionHeading(itinerary: any): string {
    if (!itinerary) {
      return 'Your trip';
    }
    const fromProp = (itinerary.itineraryName || '').trim();
    if (fromProp) {
      return fromProp;
    }
    const rawName = (itinerary.name || '').trim();
    if (rawName && !rawName.startsWith('Itinerary for ')) {
      return rawName;
    }
    return 'Your trip';
  }

  getSegmentTitle(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return `${segment.jeepneyCode || 'Transit'} (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    }
    if (segment.type === 'visit_stop') {
      return segment.description || `Enjoy your visit at ${segment.toName || 'this destination'}`;
    }
    if (segment.type === 'walk') {
      return `Walk (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    }
    return `${segment.fromName || segment.from} → ${segment.toName || segment.to}`;
  }

  getCurrentStageDescription(routeInfo: any, currentSegmentIndex: number): string {
    if (!routeInfo || !routeInfo.segments || currentSegmentIndex < 0) {
      return 'No stage selected';
    }

    const segment = routeInfo.segments[currentSegmentIndex];
    if (!segment) {
      return 'Invalid stage';
    }

    return this.getSegmentTitle(segment);
  }
}
