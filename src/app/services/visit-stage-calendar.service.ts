import { Injectable } from '@angular/core';
import { CalendarService, GlobalEvent } from './calendar.service';
import { ItinerarySession } from './itinerary-session.service';

/**
 * Helpers for matching visit_stop segments to itinerary spots and loading overlapping admin events.
 */
@Injectable({
  providedIn: 'root',
})
export class VisitStageCalendarService {
  constructor(private calendarService: CalendarService) {}

  getTodayYmd(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  findSpotByIdInItinerary(itinerary: any, spotId: string): any | null {
    const days = itinerary?.days;
    if (!Array.isArray(days)) {
      return null;
    }
    for (const day of days) {
      const spots = day?.spots;
      if (!Array.isArray(spots)) {
        continue;
      }
      const found = spots.find(
        (s: any) => s?.id === spotId || s?.spotId === spotId || s?.touristSpotId === spotId
      );
      if (found) {
        return found;
      }
    }
    return null;
  }

  extractPrimaryTimeHm(slot: unknown): string | null {
    if (slot == null) {
      return null;
    }
    const m = String(slot).match(/(\d{1,2}):(\d{2})/);
    if (!m) {
      return null;
    }
    const h = Number(m[1]);
    const min = m[2];
    if (Number.isNaN(h)) {
      return null;
    }
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  async fetchAdminOverlapForVisitStop(params: {
    segment: any;
    selectedItineraryIndex: number;
    availableItineraries: any[];
    session: ItinerarySession | null;
  }): Promise<GlobalEvent | null> {
    const segment = params.segment;
    if (!segment || segment.type !== 'visit_stop' || !segment.spotId) {
      return null;
    }

    if (!params.session?.isActive) {
      return null;
    }

    if (
      params.selectedItineraryIndex < 0 ||
      params.selectedItineraryIndex >= params.availableItineraries.length
    ) {
      return null;
    }

    const it = params.availableItineraries[params.selectedItineraryIndex];
    if (!it?.date) {
      return null;
    }

    if (it.date !== this.getTodayYmd()) {
      return null;
    }

    const spot = this.findSpotByIdInItinerary(it, segment.spotId);
    const visitHm = this.extractPrimaryTimeHm(spot?.timeSlot);
    if (!visitHm) {
      return null;
    }

    try {
      return await this.calendarService.findAdminEventOverlappingVisit({
        spotId: segment.spotId,
        date: it.date,
        visitTimeHm: visitHm,
      });
    } catch {
      return null;
    }
  }
}
