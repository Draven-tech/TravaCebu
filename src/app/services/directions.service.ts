import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DirectionsService {
  private apiKey = environment.googleMapsApiKey;
  private apiUrl = 'https://maps.googleapis.com/maps/api/directions/json';

  constructor(private http: HttpClient) {}

  getTransitRoute(origin: string, destination: string) {
    const params = {
      origin,
      destination,
      mode: 'transit',
      key: this.apiKey
    };
    return this.http.get(this.apiUrl, { params });
  }
} 