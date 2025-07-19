import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { ApiTrackerService } from './api-tracker.service';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private apiKey = environment.googleMapsApiKey;
  private proxyUrl = 'http://localhost:3001/api/places';
  private directApiUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor(private http: HttpClient, private apiTracker: ApiTrackerService) {}

  getNearbyPlaces(lat: number, lng: number, type: string, radius: number = 1000): Observable<any> {
    // Log API usage BEFORE making the call
    this.apiTracker.logApiCall('places', type, { lat, lng }).catch(err => {
      console.error('Failed to log API call:', err);
    });
    
    const params = {
      location: `${lat},${lng}`,
      radius: radius.toString(),
      type,
      key: this.apiKey
    };
    
    // Use proxy for browser, direct API for mobile
    const apiUrl = Capacitor.isNativePlatform() ? this.directApiUrl : this.proxyUrl;
    
    return this.http.get(apiUrl, { params }).pipe(
      catchError(error => {
        console.error('❌ Error fetching places:', error);
        console.error('Error details:', error.status, error.statusText, error.error);
        // Return empty results on error instead of throwing
        return new Observable(observer => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }
} 