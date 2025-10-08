import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapUIService {

  constructor() { }

  /**
   * Create marker icon for tourist spot
   */
  getMarkerIconForSpot(spot: any): L.DivIcon {
    const iconColor = this.getIconColor(spot);
    const iconName = this.getIconName(spot);
    const markerStyle = this.getMarkerStyle(spot);
    
    return L.divIcon({
      html: this.createCustomMarkerHTML(iconColor, iconName, markerStyle),
      className: 'custom-marker',
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -40]
    });
  }

  /**
   * Create route marker icon
   */
  getRouteMarkerIcon(spot: any, order: number): L.DivIcon {
    const iconColor = this.getIconColor(spot);
    const iconSymbol = this.getIconSymbol(this.getIconName(spot));
    const markerStyle = this.getMarkerStyle(spot);
    
    return L.divIcon({
      html: this.createRouteMarkerHTML(iconColor, iconSymbol, markerStyle, order),
      className: 'route-marker',
      iconSize: [35, 45],
      iconAnchor: [17, 45],
      popupAnchor: [0, -45]
    });
  }

  /**
   * Create itinerary spot popup
   */
  createItinerarySpotPopup(spot: any, order: number): string {
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
          <button onclick="window.openItinerarySpotDetails('${spot.name}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            ðŸ“ View Details
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create direction spot popup
   */
  async createDirectionSpotPopup(spot: any, order: number, jeepneyCode?: string): Promise<string> {
    // Add restaurant-specific information
    let restaurantInfo = '';
    if (spot.eventType === 'restaurant' && spot.restaurant) {
      restaurantInfo = `
        <p style="margin: 4px 0; color: #ff9800;"><strong>Restaurant:</strong> ${spot.restaurant}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #ff9800;"><strong>Rating:</strong> ${spot.rating}â˜…</p>` : ''}
        ${spot.vicinity ? `<p style="margin: 4px 0; color: #ff9800;"><strong>Location:</strong> ${spot.vicinity}</p>` : ''}
      `;
    }
    
    // Add hotel-specific information
    let hotelInfo = '';
    if (spot.eventType === 'hotel' && spot.hotel) {
      hotelInfo = `
        <p style="margin: 4px 0; color: #1976d2;"><strong>Hotel:</strong> ${spot.hotel}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #1976d2;"><strong>Rating:</strong> ${spot.rating}â˜…</p>` : ''}
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
              <button onclick="window.getWalkingDirections('${spot.name}')" 
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
          <button onclick="window.openItinerarySpotDetails('${spot.name}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            ðŸ“ View Details
          </button>
        </div>
      </div>
    `;
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  private getIconColor(spot: any): string {
    if (spot.eventType === 'restaurant') return '#ff9800';
    if (spot.eventType === 'hotel') return '#1976d2';
    if (spot.eventType === 'attraction') return '#4caf50';
    if (spot.eventType === 'shopping') return '#9c27b0';
    if (spot.eventType === 'entertainment') return '#f44336';
    return '#666666';
  }

  private getIconName(spot: any): string {
    if (spot.eventType === 'restaurant') return 'restaurant';
    if (spot.eventType === 'hotel') return 'hotel';
    if (spot.eventType === 'attraction') return 'attraction';
    if (spot.eventType === 'shopping') return 'shopping';
    if (spot.eventType === 'entertainment') return 'entertainment';
    return 'place';
  }

  private getIconSymbol(iconName: string): string {
    const symbols: { [key: string]: string } = {
      restaurant: 'R',
      hotel: 'H',
      attraction: 'A',
      shopping: 'S',
      entertainment: 'E',
      place: 'P'
    };
    return symbols[iconName] || 'P';
  }

/////////////////////////////////////////////////////////////////////////////////////


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



  /**
   * Create custom marker HTML
   */
  private createCustomMarkerHTML(iconColor: string, iconName: string, markerStyle: string): string {
    return `
      <div class="marker-container ${markerStyle}" style="
        position: relative;
        width: 30px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <div style="
          width: 24px;
          height: 24px;
          background: ${iconColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">
          ${this.getIconSymbol(iconName)}
        </div>
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 12px solid ${iconColor};
        "></div>
      </div>
    `;
  }

  /**
   * Create route marker HTML
   */
  private createRouteMarkerHTML(iconColor: string, iconSymbol: string, markerStyle: string, order: number): string {
    return `
      <div class="route-marker-container ${markerStyle}" style="
        position: relative;
        width: 35px;
        height: 45px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        <div style="
          width: 28px;
          height: 28px;
          background: ${iconColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          border: 3px solid white;
          position: relative;
        ">
          <span style="
            position: absolute;
            top: -8px;
            right: -8px;
            background: #ff4444;
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
          ">${order}</span>
          ${iconSymbol}
        </div>
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 14px solid ${iconColor};
        "></div>
      </div>
    `;
  }

  /**
   * Create user location marker
   */
  createUserLocationMarker(lat: number, lng: number, isReal: boolean = true): L.Marker {
    const icon = L.divIcon({
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: ${isReal ? '#4caf50' : '#ff9800'};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
        ">
          ${isReal ? 'L' : 'L'}
        </div>
      `,
      className: 'user-location-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
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
