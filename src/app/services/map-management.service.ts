import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapManagementService {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private userMarker?: L.Marker;
  private stopMarker?: L.Marker;
  private walkLine?: L.Polyline;
  private jeepneyLine?: L.Polyline;
  private routeLine?: L.Polyline;
  private routeLines: (L.Polyline | L.Marker)[] = [];
  private routeMarkers: L.Marker[] = [];

  constructor() { }

  /**
   * Initialize the map with default settings
   */
  initMap(mapElementId: string = 'map'): L.Map {
    try {
      if (this.map) {
        this.map.remove();
      }
      
      const mapElement = document.getElementById(mapElementId);
      if (!mapElement) {
        throw new Error('Map element not found');
      }

      this.map = L.map(mapElementId, {
        center: [10.3157, 123.8854],
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true
      });

      // Add OpenStreetMap tile layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Â© OpenStreetMap contributors',
        maxZoom: 18,
      });
      
      // Add OSM layer
      osmLayer.addTo(this.map);

      // Ensure map is properly sized
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 300);
      
      return this.map;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the current map instance
   */
  getMap(): L.Map {
    return this.map;
  }


  /////////////////////////////// onTileChange ////////////////////////////////////

  clearAllMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
  }

  clearRouteMarkers(): void {
    this.routeMarkers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.routeMarkers = [];
  }

  clearAllRouteLines(): void {
    this.routeLines.forEach(line => {
      if (this.map) {
        this.map.removeLayer(line);
      }
    });
    this.routeLines = [];
    
    if (this.walkLine && this.map) {
      this.map.removeLayer(this.walkLine);
      this.walkLine = undefined;
    }
    
    if (this.jeepneyLine && this.map) {
      this.map.removeLayer(this.jeepneyLine);
      this.jeepneyLine = undefined;
    }
    
    if (this.routeLine && this.map) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = undefined;
    }
  }


  invalidateSize(): void {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  /////////////////////////// onTileChange //////////////////////////////


  changeTileLayer(tileType: string): void {
    if (!this.map) return;

    // Remove existing tile layer
    this.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        this.map.removeLayer(layer);
      }
    });

    let tileLayer: L.TileLayer;
    
    switch (tileType) {
      case 'satellite':
        tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: 'Â© Google',
          maxZoom: 20,
        });
        break;
      case 'terrain':
        tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: 'Â© Google',
          maxZoom: 20,
        });
        break;
      case 'hybrid':
        tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: 'Â© Google',
          maxZoom: 20,
        });
        break;
      default: // 'osm'
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Â© OpenStreetMap contributors',
          maxZoom: 18,
        });
    }

    tileLayer.addTo(this.map);
  }

  ////////////////////////////////////////// showDirectionsAndRoutes, map-management.service.ts ///////////////////////////////////////////////////////////

  showItinerarySpots(itinerary: any, mapUI: any): void {
    try {
      this.clearAllMarkers();
      
      if (!itinerary || !itinerary.days) {
        return;
      }
      
      const locationMap = new Map();
      let spotIndex = 1;
      
      // Iterate through all days in the itinerary
      for (const day of itinerary.days) {
        if (!day.spots) {
          continue;
        }
        
        // Handle different spot data structures
        const spots = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
        
        for (const spot of spots) {
          if (!spot || !spot.location || !spot.location.lat || !spot.location.lng) {
            continue;
          }
          
          const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
          
          if (!locationMap.has(locationKey)) {
            const marker = L.marker([spot.location.lat, spot.location.lng], {
              icon: mapUI.getRouteMarkerIcon(spot, spotIndex)
            });
            
            const popupContent = mapUI.createItinerarySpotPopup(spot, spotIndex);
            marker.bindPopup(popupContent);
            
            this.addMarker(marker);
            locationMap.set(locationKey, true);
            spotIndex++;
          }
        }
      }
      
      this.fitToMarkers();
      
    } catch (error) {
      // Silently handle errors
    }
  }

  //////////////////////////////////////////// map-management.service.ts ///////////////////////////////////////////

  showTouristSpots(touristSpots: any[], mapUI: any): void {
    try {
      this.clearAllMarkers();
      
      const locationMap = new Map();
      
      for (const spot of touristSpots) {
        if (!spot.location || !spot.location.lat || !spot.location.lng) {
          continue;
        }
        
        const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
        
        if (!locationMap.has(locationKey)) {
          const marker = L.marker([spot.location.lat, spot.location.lng], {
            icon: mapUI.getMarkerIconForSpot(spot)
          });
          
          const popupContent = this.createSpotPopup(spot);
          marker.bindPopup(popupContent);
          
          this.addMarker(marker);
          locationMap.set(locationKey, true);
        }
      }
      
      this.fitToMarkers();
      
    } catch (error) {
      // Silently handle error
    }
  }

  /**
   * Add a marker to the map
   */
  addMarker(marker: L.Marker): void {
    if (this.map) {
      marker.addTo(this.map);
      this.markers.push(marker);
    }
  }

  /**
   * Add a route marker
   */
  addRouteMarker(marker: L.Marker): void {
    if (this.map) {
      marker.addTo(this.map);
      this.routeMarkers.push(marker);
    }
  }

  /**
   * Add a route line
   */
  addRouteLine(line: L.Polyline): void {
    if (this.map) {
      line.addTo(this.map);
      this.routeLines.push(line);
    }
  }

  /**
   * Set user marker
   */
  setUserMarker(marker: L.Marker): void {
    if (this.userMarker && this.map) {
      this.map.removeLayer(this.userMarker);
    }
    this.userMarker = marker;
    if (this.map) {
      marker.addTo(this.map);
    }
  }

  /**
   * Set stop marker
   */
  setStopMarker(marker: L.Marker): void {
    if (this.stopMarker && this.map) {
      this.map.removeLayer(this.stopMarker);
    }
    this.stopMarker = marker;
    if (this.map) {
      marker.addTo(this.map);
    }
  }

  /**
   * Set walk line
   */
  setWalkLine(line: L.Polyline): void {
    if (this.walkLine && this.map) {
      this.map.removeLayer(this.walkLine);
    }
    this.walkLine = line;
    if (this.map) {
      line.addTo(this.map);
    }
  }

  /**
   * Set jeepney line
   */
  setJeepneyLine(line: L.Polyline): void {
    if (this.jeepneyLine && this.map) {
      this.map.removeLayer(this.jeepneyLine);
    }
    this.jeepneyLine = line;
    if (this.map) {
      line.addTo(this.map);
    }
  }

  /**
   * Set route line
   */
  setRouteLine(line: L.Polyline): void {
    if (this.routeLine && this.map) {
      this.map.removeLayer(this.routeLine);
    }
    this.routeLine = line;
    if (this.map) {
      line.addTo(this.map);
    }
  }

  /**
   * Fit map to show all markers
   */
  fitToMarkers(): void {
    if (!this.map || this.markers.length === 0) return;

    const group = new L.FeatureGroup(this.markers);
    this.map.fitBounds(group.getBounds().pad(0.1));
  }

  /**
   * Fit map to show specific bounds
   */
  fitToBounds(bounds: L.LatLngBounds): void {
    if (this.map) {
      this.map.fitBounds(bounds);
    }
  }

  /**
   * Center map on location
   */
  centerOnLocation(lat: number, lng: number, zoom?: number): void {
    if (this.map) {
      this.map.setView([lat, lng], zoom || this.map.getZoom());
    }
  }

  /**
   * Remove the map
   */
  removeMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null as any;
    }
    
    // Clear all references
    this.markers = [];
    this.routeMarkers = [];
    this.routeLines = [];
    this.userMarker = undefined;
    this.stopMarker = undefined;
    this.walkLine = undefined;
    this.jeepneyLine = undefined;
    this.routeLine = undefined;
  }

  /**
   * Get all markers
   */
  getMarkers(): L.Marker[] {
    return this.markers;
  }

  /**
   * Get route markers
   */
  getRouteMarkers(): L.Marker[] {
    return this.routeMarkers;
  }

  /**
   * Get route lines
   */
  getRouteLines(): (L.Polyline | L.Marker)[] {
    return this.routeLines;
  }

  /**
   * Create spot popup content
   */
  private createSpotPopup(spot: any): string {
    return `
      <div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${spot.name}</h4>
        <p style="margin: 4px 0; color: #666;">${spot.description || 'No description available'}</p>
        <div style="margin-top: 12px;">
          <button onclick="window.openSpotDetails('${spot.name}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
            View Details
          </button>
        </div>
      </div>
    `;
  }

}
