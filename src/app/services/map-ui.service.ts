import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapUIService {

  constructor() { }

  private escapeForSingleQuotedJs(value: string): string {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }

  /** Scale spot markers when zoomed out so crowded pins stay readable; user marker unchanged. */
  private spotIconScaleForZoom(zoom: number): number {
    if (zoom >= 14) {
      return 1;
    }
    if (zoom <= 9) {
      return 0.5;
    }
    return 0.5 + ((zoom - 9) / 5) * 0.5;
  }

  private px(scale: number, v: number, min = 1): number {
    return Math.max(min, Math.round(v * scale));
  }

  private fs(scale: number, v: number, minPx: number): number {
    return Math.max(minPx, Math.round(v * scale));
  }

  /**
   * Create marker icon for tourist spot
   * @param zoom map zoom level; omit or pass high value for full-size (e.g. exports)
   */
  getMarkerIconForSpot(spot: any, zoom?: number): L.DivIcon {
    const scale = zoom != null ? this.spotIconScaleForZoom(zoom) : 1;
    const w = this.px(scale, 30);
    const h = this.px(scale, 40);
    const ax = this.px(scale, 15);
    const ay = this.px(scale, 40);
    const src = this.getSpotMarkerAssetPath(spot);
    const markerStyle = this.getMarkerStyle(spot);

    return L.divIcon({
      html: `
        <div class="marker-container map-spot-png-wrap ${markerStyle}" style="
          position: relative;
          width: ${w}px;
          height: ${h}px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          line-height: 0;
        ">
          <img src="${src}" alt="" width="${w}" height="${h}"
            style="object-fit: contain; display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));" />
        </div>`,
      className: 'custom-marker',
      iconSize: [w, h],
      iconAnchor: [ax, ay],
      popupAnchor: [0, -ay]
    });
  }

  /**
   * Itinerary-order pins on the map (PNG + badge), zoom-scaled like tourist spots.
   */
  getRouteMarkerIcon(spot: any, order: number, zoom?: number): L.DivIcon {
    const scale = zoom != null ? this.spotIconScaleForZoom(zoom) : 1;
    const w = this.px(scale, 35);
    const h = this.px(scale, 45);
    const ax = this.px(scale, 17);
    const ay = this.px(scale, 45);

    return L.divIcon({
      html: this.createRouteMarkerPngHTML(spot, order, scale),
      className: 'route-marker',
      iconSize: [w, h],
      iconAnchor: [ax, ay],
      popupAnchor: [0, -ay]
    });
  }

  /**
   * Create itinerary spot popup
   */
  createItinerarySpotPopup(spot: any, order: number): string {
    const escapedSpotName = this.escapeForSingleQuotedJs(spot.name || '');
    return `
      <div style="min-width: 250px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${order}. ${spot.name}</h4>
        <p style="margin: 4px 0; color: #666;">
          <strong>Time:</strong> ${spot.timeSlot || 'TBD'}
        </p>
        <p style="margin: 4px 0; color: #666;">
          <strong>Duration:</strong> ${spot.estimatedDuration || '1 hour'}
        </p>
        ${spot.mealType ? `<p style="margin: 4px 0; color: #ff6b35;"><strong>Meal:</strong> ${spot.mealType}</p>` : ''}
        ${spot.category ? `<p style="margin: 4px 0; color: #666;"><strong>Type:</strong> ${spot.category}</p>` : ''}
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          <button onclick="window.openItinerarySpotDetails('${escapedSpotName}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            📍View Details
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create direction spot popup
   */
  async createDirectionSpotPopup(spot: any, order: number, jeepneyCode?: string): Promise<string> {
    const escapedSpotName = this.escapeForSingleQuotedJs(spot.name || '');
    // Add restaurant-specific information
    let restaurantInfo = '';
    if (spot.eventType === 'restaurant' && spot.restaurant) {
      restaurantInfo = `
        <p style="margin: 4px 0; color: #ff9800;"><strong>Restaurant:</strong> ${spot.restaurant}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #ff9800;"><strong>Rating:</strong> ${spot.rating}⭐</p>` : ''}
        ${spot.vicinity ? `<p style="margin: 4px 0; color: #ff9800;"><strong>Location:</strong> ${spot.vicinity}</p>` : ''}
      `;
    }
    
    // Add hotel-specific information
    let hotelInfo = '';
    if (spot.eventType === 'hotel' && spot.hotel) {
      hotelInfo = `
        <p style="margin: 4px 0; color: #1976d2;"><strong>Hotel:</strong> ${spot.hotel}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #1976d2;"><strong>Rating:</strong> ${spot.rating}⭐</p>` : ''}
        ${spot.vicinity ? `<p style="margin: 4px 0; color: #1976d2;"><strong>Location:</strong> ${spot.vicinity}</p>` : ''}
      `;
    }
    
    return `
      <div style="min-width: 250px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${order}. ${spot.name}</h4>
        <p style="margin: 4px 0; color: #666;">
          <strong>Time:</strong> ${spot.timeSlot || 'TBD'}
        </p>
        <p style="margin: 4px 0; color: #666;">
          <strong>Duration:</strong> ${spot.estimatedDuration || '1 hour'}
        </p>
        ${spot.mealType ? `<p style="margin: 4px 0; color: #ff6b35;"><strong>Meal:</strong> ${spot.mealType}</p>` : ''}
        ${spot.category ? `<p style="margin: 4px 0; color: #666;"><strong>Type:</strong> ${spot.category}</p>` : ''}
        ${restaurantInfo}
        ${hotelInfo}
        ${jeepneyCode ? 
          jeepneyCode.includes('No transit data') ? 
            `<div style="margin: 8px 0; padding: 12px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border-left: 4px solid #ff9800;">
              <p style="margin: 0 0 8px 0; color: #ff9800; font-weight: bold;">Sorry, we could not calculate and fetch transit directions to this location.</p>
              <button onclick="window.getWalkingDirections('${escapedSpotName}')" 
                      style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                Get Walking Directions
              </button>
            </div>` :
          jeepneyCode.includes('Walking') ? 
            `<p style="margin: 4px 0; color: #ff6b35; font-weight: bold;"><strong>Transport:</strong> Walking route available</p>` :
            `<p style="margin: 4px 0; color: #1976d2; font-weight: bold;"><strong>Jeepney:</strong> ${jeepneyCode}</p>`
          : ''
        }
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          <button onclick="window.openItinerarySpotDetails('${escapedSpotName}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            📍“ View Details
          </button>
        </div>
      </div>
    `;
  }

  /** PNG under `src/assets/map/` for map pins (hotel / restaurant / default spot). */
  private getSpotMarkerAssetPath(spot: any): string {
    if (spot?.eventType === 'hotel') {
      return 'assets/map/hotel.png';
    }
    if (spot?.eventType === 'restaurant') {
      return 'assets/map/restaurant.png';
    }
    return 'assets/map/spot.png';
  }

  /**
   * Get marker style based on spot type
   */
  private getMarkerStyle(spot: any): string {
    if (spot.eventType === 'restaurant') return 'restaurant-marker';
    if (spot.eventType === 'hotel') return 'hotel-marker';
    if (spot.eventType === 'attraction') return 'attraction-marker';
    if (spot.eventType === 'shopping') return 'shopping-marker';
    if (spot.eventType === 'entertainment') return 'entertainment-marker';
    return 'default-marker';
  }

  private createRouteMarkerPngHTML(spot: any, order: number, scale: number): string {
    const w = this.px(scale, 35);
    const h = this.px(scale, 45);
    const src = this.getSpotMarkerAssetPath(spot);
    const markerStyle = this.getMarkerStyle(spot);
    const badge = this.px(scale, 18);
    const badgeFs = this.fs(scale, 10, 7);
    const badgeOff = this.px(scale, 8);
    const badgeBorder = Math.max(1, this.px(scale, 2));

    return `
      <div class="route-marker-container map-spot-png-wrap ${markerStyle}" style="
        position: relative;
        width: ${w}px;
        height: ${h}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        line-height: 0;
      ">
        <img src="${src}" alt="" width="${w}" height="${h}"
          style="object-fit: contain; display: block; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));" />
        <span style="
          position: absolute;
          top: -${badgeOff}px;
          right: -${badgeOff}px;
          background: #ff4444;
          color: white;
          border-radius: 50%;
          width: ${badge}px;
          height: ${badge}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${badgeFs}px;
          font-weight: bold;
          border: ${badgeBorder}px solid white;
          box-sizing: border-box;
        ">${order}</span>
      </div>
    `;
  }

  createUserLocationMarker(lat: number, lng: number, isReal: boolean = true): L.Marker {
    const size = 28;
    const half = size / 2;
    const icon = L.divIcon({
      html: `<img src="assets/map/user.png" alt="" width="${size}" height="${size}" style="object-fit:contain;display:block;" />`,
      className: 'user-location-marker' + (isReal ? '' : ' user-location-marker--mock'),
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half]
    });

    return L.marker([lat, lng], { icon });
  }

  /**
   * Create jeepney stop marker
   */
  createJeepneyStopMarker(lat: number, lng: number, jeepneyCode: string): L.Marker {
    const icon = L.divIcon({
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #1976d2;
          border-radius: 4px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: bold;
        ">
          ${jeepneyCode}
        </div>
      `,
      className: 'jeepney-stop-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    return L.marker([lat, lng], { icon });
  }
}
