import { Injectable } from '@angular/core';
import { MapUtilitiesService } from './map-utilities.service';
import { UserLocation } from './location-tracking.service';

const AUTO_ADVANCE_STORAGE_KEY = 'lakaw_auto_advance_enabled';

/** Mutable walk-guidance fields usually owned by UserMapPage. */
export interface WalkGuidanceUiState {
  lakawWalkRemainingM: number | null;
  lastLakawRemainUiMs: number;
  lastLakawRemainMUi: number | null;
  lastFollowPanMs: number;
  lakawAutoAdvancedForSegmentIndex: number | null;
  lakawWalkPolylineSyncSegmentIndex: number | null;
}

export interface WalkLocationEffect {
  ui: WalkGuidanceUiState;
  panTo?: { lat: number; lng: number; animate: boolean; duration: number };
  shouldAutoNextSegment?: boolean;
  toastAlmostThere?: boolean;
}

/**
 * Walk-segment distance, follow-pan throttling, and auto-advance near end of polyline.
 */
@Injectable({
  providedIn: 'root',
})
export class WalkGuidanceService {
  constructor(private mapUtils: MapUtilitiesService) {}

  loadAutoAdvanceFromStorage(): boolean {
    try {
      const raw = localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY);
      if (raw != null) {
        return JSON.parse(raw) === true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  saveAutoAdvanceToStorage(enabled: boolean): void {
    try {
      localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, JSON.stringify(!!enabled));
    } catch {
      // ignore
    }
  }

  syncAfterSegmentPaint(isWalkSegment: boolean, currentSegmentIndex: number, ui: WalkGuidanceUiState): WalkGuidanceUiState {
    if (isWalkSegment) {
      if (ui.lakawWalkPolylineSyncSegmentIndex !== currentSegmentIndex) {
        return {
          ...ui,
          lakawWalkPolylineSyncSegmentIndex: currentSegmentIndex,
          lakawAutoAdvancedForSegmentIndex: null,
          lastLakawRemainMUi: null,
          lastLakawRemainUiMs: 0,
        };
      }
      return { ...ui };
    }
    return {
      ...ui,
      lakawWalkRemainingM: null,
      lakawAutoAdvancedForSegmentIndex: null,
    };
  }

  processWalkLocationUpdate(
    location: UserLocation,
    currentRouteInfo: any,
    currentSegmentIndex: number,
    autoAdvanceEnabled: boolean,
    ui: WalkGuidanceUiState
  ): WalkLocationEffect {
    let next: WalkGuidanceUiState = { ...ui };

    if (!currentRouteInfo?.segments?.length) {
      next.lakawWalkRemainingM = null;
      return { ui: next };
    }

    const seg = currentRouteInfo.segments[currentSegmentIndex];
    if (!seg || seg.type !== 'walk') {
      next.lakawWalkRemainingM = null;
      return { ui: next };
    }

    const points = this.mapUtils.getWalkPolylineLatLng(seg);
    if (!points.length) {
      next.lakawWalkRemainingM = null;
      return { ui: next };
    }

    const remaining = this.mapUtils.remainingWalkAlongPolyline(points, location.lat, location.lng);
    if (remaining == null) {
      return { ui: next };
    }

    const now = Date.now();
    if (
      next.lastLakawRemainMUi == null ||
      now - next.lastLakawRemainUiMs > 2000 ||
      Math.abs(remaining - (next.lastLakawRemainMUi ?? 0)) > 8
    ) {
      next.lastLakawRemainUiMs = now;
      next.lastLakawRemainMUi = remaining;
      next.lakawWalkRemainingM = Math.max(0, Math.round(remaining));
    }

    let panTo: WalkLocationEffect['panTo'];
    if (now - next.lastFollowPanMs > 850) {
      next.lastFollowPanMs = now;
      panTo = { lat: location.lat, lng: location.lng, animate: true, duration: 0.22 };
    }

    let shouldAutoNextSegment = false;
    let toastAlmostThere = false;
    if (
      autoAdvanceEnabled &&
      remaining < 35 &&
      (location.accuracy ?? 999) < 40 &&
      next.lakawAutoAdvancedForSegmentIndex !== currentSegmentIndex
    ) {
      next.lakawAutoAdvancedForSegmentIndex = currentSegmentIndex;
      shouldAutoNextSegment = true;
      toastAlmostThere = true;
    }

    return { ui: next, panTo, shouldAutoNextSegment, toastAlmostThere };
  }
}
