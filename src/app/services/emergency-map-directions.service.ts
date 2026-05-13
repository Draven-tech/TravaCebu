import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { RoutePlanningService } from './route-planning.service';
import { LocationTrackingService } from './location-tracking.service';
import { MapUtilitiesService } from './map-utilities.service';
import { EmergencyMapFocusPayload } from './map-focus-intent.service';

/**
 * Emergency POI focus pin on the map and OSRM-backed directions from the user location.
 */
@Injectable({
  providedIn: 'root',
})
export class EmergencyMapDirectionsService {
  constructor(
    private routePlanning: RoutePlanningService,
    private locationTracking: LocationTrackingService,
    private mapUtils: MapUtilitiesService
  ) {}

  escapeHtmlForMapPopup(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async waitForMapReady(
    getMap: () => L.Map | undefined,
    retries = 20,
    delayMs = 80
  ): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      if (getMap()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return !!getMap();
  }

  createEmergencyFocusMarker(
    map: L.Map,
    payload: { lat: number; lng: number; name: string; address?: string }
  ): L.Marker {
    const icon = L.divIcon({
      className: 'emergency-focus-marker-wrap',
      html: '<div class="emergency-focus-pin" aria-hidden="true"></div>',
      iconSize: [32, 36],
      iconAnchor: [16, 34],
      popupAnchor: [0, -30],
    });

    const marker = L.marker([payload.lat, payload.lng], { icon });
    const safeName = this.escapeHtmlForMapPopup(payload.name);
    const safeAddr = payload.address ? this.escapeHtmlForMapPopup(payload.address) : '';
    marker.bindPopup(
      `<div class="emergency-focus-popup"><strong>${safeName}</strong>${
        safeAddr ? `<br><span>${safeAddr}</span>` : ''
      }</div>`,
      { maxWidth: 280 }
    );
    marker.addTo(map);
    marker.openPopup();
    return marker;
  }

  normalizeEmergencyRouteSegments(routeInfo: any): void {
    if (!routeInfo?.segments?.length) {
      return;
    }
    routeInfo.segments.forEach((segment: any, index: number) => {
      segment.stage = index + 1;
      if (!segment.estimatedTime && segment.duration != null) {
        segment.estimatedTime = this.mapUtils.formatDuration(segment.duration);
      }
    });
  }

  async loadEmergencyRouteInfo(
    payload: EmergencyMapFocusPayload
  ): Promise<{ routeInfo: any } | { error: 'no_segments' | 'unknown' }> {
    try {
      const userLocation = await this.locationTracking.getLocationWithFallback();
      const routeInfo = await this.routePlanning.generateRouteInfoForEmergencyDestination(userLocation, {
        name: payload.name,
        lat: payload.lat,
        lng: payload.lng,
        placeId: payload.placeId,
      });

      if (!routeInfo?.segments?.length) {
        return { error: 'no_segments' };
      }

      this.normalizeEmergencyRouteSegments(routeInfo);
      return { routeInfo };
    } catch {
      return { error: 'unknown' };
    }
  }
}
