import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiTrackerService } from './api-tracker.service';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private apiKey = environment.googleMapsApiKey;
  private proxyUrl = 'https://google-places-proxy-ftxx.onrender.com/api/places';
  private directApiUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor(private http: HttpClient, private apiTracker: ApiTrackerService) {}

  // Test method to verify API key is working
  testApiKey(): Observable<any> {
    const testParams = {
      location: '10.3157,123.8854', // Cebu City coordinates
      radius: '1000',
      type: 'restaurant',
      key: this.apiKey
    };
    
    console.log('🧪 Testing API key with params:', testParams);
    
    // Always use proxy for all platforms
    return this.http.get(this.proxyUrl, { params: testParams }).pipe(
      catchError(error => {
        console.error('❌ API key test failed:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

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
    
    // Always use proxy for all platforms
    const apiUrl = this.proxyUrl;
    
    console.log(`🔍 Fetching places from: ${apiUrl}`);
    console.log(`📍 Location: ${lat},${lng}, Type: ${type}, Radius: ${radius}`);
    
    return this.http.get(apiUrl, { params }).pipe(
      // Debug log the response
      tap((resp: any) => {
        console.log('✅ Places API response:', resp);
      }),
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