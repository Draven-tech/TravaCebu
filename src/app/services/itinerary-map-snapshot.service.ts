import { Injectable } from '@angular/core';
import { ItinerarySession } from './itinerary-session.service';
import { UserLocation } from './location-tracking.service';

export interface ItineraryMapSnapshotPayload {
  reason: string;
  selectedItineraryIndex: number;
  currentSegmentIndex: number;
  userLocation: UserLocation | null;
  routeInfo: any;
}

/**
 * Persists itinerary map progress and full route JSON for resume (localStorage).
 */
@Injectable({
  providedIn: 'root',
})
export class ItineraryMapSnapshotService {
  private readonly itineraryProgressSnapshotKey = 'itinerary_progress_snapshot';
  private readonly itineraryRouteSnapshotKey = 'itinerary_route_snapshot';

  saveProgressAndRoute(payload: ItineraryMapSnapshotPayload): void {
    try {
      const userLocation = payload.userLocation;
      const progressSnapshot = {
        savedAt: new Date().toISOString(),
        reason: payload.reason,
        selectedItineraryIndex: payload.selectedItineraryIndex,
        currentSegmentIndex: payload.currentSegmentIndex,
        userPosition: userLocation
          ? {
              lat: userLocation.lat,
              lng: userLocation.lng,
              accuracy: userLocation.accuracy ?? null,
            }
          : null,
      };
      localStorage.setItem(this.itineraryProgressSnapshotKey, JSON.stringify(progressSnapshot));

      const route = payload.routeInfo;
      if (route?.segments?.length) {
        const routeSnapshot = {
          savedAt: new Date().toISOString(),
          reason: payload.reason,
          selectedItineraryIndex: payload.selectedItineraryIndex,
          currentSegmentIndex: payload.currentSegmentIndex,
          routeInfo: route,
        };
        localStorage.setItem(this.itineraryRouteSnapshotKey, JSON.stringify(routeSnapshot));
      }
    } catch (error) {
      console.warn('Failed to save itinerary progress snapshot:', error);
    }
  }

  /**
   * Returns restored routeInfo when snapshot matches session and is not stale.
   */
  tryRestoreRouteSnapshot(session: ItinerarySession): any | null {
    try {
      const raw = localStorage.getItem(this.itineraryRouteSnapshotKey);
      if (!raw) {
        return null;
      }

      const snapshot = JSON.parse(raw);
      if (
        !snapshot ||
        !snapshot.routeInfo?.segments?.length ||
        snapshot.selectedItineraryIndex !== session.selectedItineraryIndex
      ) {
        return null;
      }

      const sessionUpdatedAt = new Date(session.lastUpdated).getTime();
      const snapshotSavedAt = new Date(snapshot.savedAt).getTime();
      if (
        Number.isFinite(sessionUpdatedAt) &&
        Number.isFinite(snapshotSavedAt) &&
        snapshotSavedAt < sessionUpdatedAt
      ) {
        return null;
      }

      return snapshot.routeInfo;
    } catch (error) {
      console.warn('Failed to restore itinerary route snapshot:', error);
      return null;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.itineraryProgressSnapshotKey);
      localStorage.removeItem(this.itineraryRouteSnapshotKey);
    } catch (error) {
      console.warn('Failed to clear itinerary snapshots:', error);
    }
  }
}
