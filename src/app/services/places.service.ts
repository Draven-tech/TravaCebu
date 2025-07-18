import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private apiKey = environment.googleMapsApiKey;
  private apiUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor(private http: HttpClient) {}

  getNearbyPlaces(lat: number, lng: number, type: string, radius: number = 1000) {
    const params = {
      location: `${lat},${lng}`,
      radius: radius.toString(),
      type,
      key: this.apiKey
    };
    return this.http.get(this.apiUrl, { params });
  }
} 