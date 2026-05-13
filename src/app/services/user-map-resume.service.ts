import { Injectable } from '@angular/core';
import { ItinerarySession } from './itinerary-session.service';
import { ItineraryRouteLabelService } from './itinerary-route-label.service';

export interface ResumableSessionMeta {
  title: string;
  dayLabel: string;
  stageLabel: string;
}

/**
 * Validates an active itinerary session against loaded calendar itineraries and builds resume UI meta.
 */
@Injectable({
  providedIn: 'root',
})
export class UserMapResumeService {
  constructor(private routeLabels: ItineraryRouteLabelService) {}

  getValidResumableSession(
    session: ItinerarySession | null,
    availableItineraries: any[]
  ): ItinerarySession | null {
    if (!session?.isActive) {
      return null;
    }

    if (session.selectedItineraryIndex < 0 || session.selectedItineraryIndex >= availableItineraries.length) {
      return null;
    }

    const itineraryAtIndex = availableItineraries[session.selectedItineraryIndex];
    if (!itineraryAtIndex || !this.isSameItinerary(session.selectedItinerary, itineraryAtIndex)) {
      return null;
    }

    return session;
  }

  isSameItinerary(savedItinerary: any, availableItinerary: any): boolean {
    if (!savedItinerary || !availableItinerary) {
      return false;
    }

    if (savedItinerary.id && availableItinerary.id) {
      return savedItinerary.id === availableItinerary.id;
    }

    const savedName = savedItinerary.name || savedItinerary.itineraryName;
    const availableName = availableItinerary.name || availableItinerary.itineraryName;
    const sameName = !!savedName && savedName === availableName;
    const sameDate = !!savedItinerary.date && savedItinerary.date === availableItinerary.date;
    return sameName || sameDate;
  }

  buildResumableSessionMeta(session: ItinerarySession, itinerary: any): ResumableSessionMeta {
    const fallbackTitle = this.routeLabels.formatItineraryTitle(session.selectedItinerary);
    const title = itinerary ? this.routeLabels.formatItineraryTitle(itinerary) : fallbackTitle;
    const dayLabel = itinerary?.date ? `Day ${itinerary.date}` : '';
    const stageLabel = `Stage ${(session.currentSegmentIndex || 0) + 1}`;

    return {
      title,
      dayLabel,
      stageLabel,
    };
  }

  /**
   * Derives Continue Trip chip visibility and session cleanup when the saved session no longer matches Firestore itineraries.
   */
  computeResumeBannerState(
    session: ItinerarySession | null,
    availableItineraries: any[],
    selectedItineraryIndex: number
  ): { shouldEndStaleSession: boolean; hasResumableSession: boolean; meta: ResumableSessionMeta } {
    const validSession = this.getValidResumableSession(session, availableItineraries);
    const shouldEndStaleSession = !validSession && !!session?.isActive;
    const hasResumableSession = !!validSession && selectedItineraryIndex < 0;

    let meta: ResumableSessionMeta = {
      title: '',
      dayLabel: '',
      stageLabel: '',
    };

    if (validSession) {
      const itineraryAtIndex =
        availableItineraries[validSession.selectedItineraryIndex] || validSession.selectedItinerary;
      meta = this.buildResumableSessionMeta(validSession, itineraryAtIndex);
    }

    return { shouldEndStaleSession, hasResumableSession, meta };
  }
}
