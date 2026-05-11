import { Injectable } from '@angular/core';

export interface EmergencyMapFocusPayload {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  placeId?: string;
  requestDirections?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapFocusIntentService {
  private pendingEmergencyFocus: EmergencyMapFocusPayload | null = null;

  setEmergencyPlaceFocus(payload: EmergencyMapFocusPayload): void {
    this.pendingEmergencyFocus = payload;
  }
  consumeEmergencyPlaceFocus(): EmergencyMapFocusPayload | null {
    const p = this.pendingEmergencyFocus;
    this.pendingEmergencyFocus = null;
    return p;
  }
}
