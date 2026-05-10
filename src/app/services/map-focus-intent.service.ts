import { Injectable } from '@angular/core';

/** Passed when navigating from Emergency Info (or similar) to open User Map at a POI. */
export interface EmergencyMapFocusPayload {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  placeId?: string;
  /** When set, User Map loads transit/walking directions from the user location to this place. */
  requestDirections?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapFocusIntentService {
  private pendingEmergencyFocus: EmergencyMapFocusPayload | null = null;

  setEmergencyPlaceFocus(payload: EmergencyMapFocusPayload): void {
    this.pendingEmergencyFocus = payload;
  }

  /** Returns the payload once, then clears it (single consumer). */
  consumeEmergencyPlaceFocus(): EmergencyMapFocusPayload | null {
    const p = this.pendingEmergencyFocus;
    this.pendingEmergencyFocus = null;
    return p;
  }
}
