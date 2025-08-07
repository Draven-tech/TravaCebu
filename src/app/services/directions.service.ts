import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DirectionsService {
  private apiKey = environment.googleMapsApiKey;
  private proxyUrl = 'https://google-places-proxy-ftxx.onrender.com';

  constructor(private http: HttpClient) {}

  getTransitRoute(origin: string, destination: string) {
    const params = {
      origin,
      destination,
      mode: 'transit',
      key: this.apiKey
    };
    return this.http.get(`${this.proxyUrl}/api/directions`, { params });
  }

  getDirections(origin: string, destination: string, waypoints?: string, mode?: string, alternatives?: boolean) {
    const params: any = {
      origin,
      destination,
      key: this.apiKey
    };
    
    if (waypoints) {
      params.waypoints = waypoints;
    }
    
    if (mode) {
      params.mode = mode;
    }
    
    if (alternatives) {
      params.alternatives = 'true';
    }
    
    return this.http.get(`${this.proxyUrl}/api/directions`, { params });
  }

  // New method for Google Routes API
  computeRoutes(requestBody: any) {
    const params = {
      key: this.apiKey
    };
    return this.http.post(`${this.proxyUrl}/api/routes`, requestBody, { params });
  }

  // Method for OSRM routing (backup)
  getOsrmRoute(coordinates: string, profile: string = 'driving') {
    const params = {
      coordinates,
      profile
    };
    return this.http.get(`${this.proxyUrl}/api/osrm`, { params });
  }
} 