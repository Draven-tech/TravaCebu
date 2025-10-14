import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiTrackerService } from './api-tracker.service';

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
    
    // Always use proxy for all platforms
    return this.http.get(this.proxyUrl, { params: testParams }).pipe(
      catchError(error => {
        console.error('❌Œ API key test failed:', error);
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
    
    return this.http.get(apiUrl, { params }).pipe(
      // Debug log the response
      tap((resp: any) => {
      }),
      catchError(error => {
        console.error('❌Œ Error fetching places:', error);
        console.error('Error details:', error.status, error.statusText, error.error);
        // Return empty results on error instead of throwing
        return new Observable(observer => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  // Get place details including photos
  getPlaceDetails(placeId: string): Observable<any> {
    // Log API usage BEFORE making the call
    this.apiTracker.logApiCall('places', 'details', { placeId }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      place_id: placeId,
      fields: 'name,formatted_address,geometry,photos,types,rating,user_ratings_total,opening_hours',
      key: this.apiKey
    };

    // Use the working proxy for place details
    const detailsUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/details';
    
    return this.http.get(detailsUrl, { params }).pipe(
      tap((resp: any) => {
      }),
      catchError(error => {
        console.error('❌Œ Error fetching place details:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  // Get place photos
  getPlacePhotos(placeId: string, maxPhotos: number = 5): Observable<any> {
    // Log API usage BEFORE making the call
    this.apiTracker.logApiCall('places', 'photos', { placeId }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      place_id: placeId,
      fields: 'photos',
      key: this.apiKey
    };

    const photosUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/details';
    
    return this.http.get(photosUrl, { params }).pipe(
      tap((resp: any) => {
      }),
      catchError(error => {
        console.error('❌Œ Error fetching place photos:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  // Search for a place by name and location to get its place_id
  searchPlaceByName(name: string, lat: number, lng: number): Observable<any> {
    // Log API usage BEFORE making the call
    this.apiTracker.logApiCall('places', 'textsearch', { name, lat, lng }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    // Force Cebu City coordinates for all searches
    const cebuLat = 10.3157;
    const cebuLng = 123.8854;

    const params = {
      query: `${name} Cebu Philippines`, // Add "Cebu Philippines" to force local results
      location: `${cebuLat},${cebuLng}`,
      radius: '30000', // 30km radius to cover greater Cebu area
      key: this.apiKey
    };

    const searchUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/textsearch';
    
    return this.http.get(searchUrl, { params }).pipe(
      tap((searchResult: any) => {
      }),
      map((searchResult: any) => {
        // Filter results to only include Cebu locations
        if (searchResult.results) {
          searchResult.results = searchResult.results.filter((place: any) => {
            const address = place.formatted_address?.toLowerCase() || '';
            return address.includes('cebu') || 
                   address.includes('philippines') ||
                   address.includes('cebu city') ||
                   address.includes('mandaue') ||
                   address.includes('lapu-lapu') ||
                   address.includes('talisay');
          });
        }
        return searchResult;
      }),
      catchError(error => {
        console.error('❌Œ Error searching place:', error);
        // Return empty results on error instead of throwing
        return new Observable(observer => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  // Generate Google Places photo URL
  getPhotoUrl(photoReference: string, maxWidth: number = 400, maxHeight: number = 300): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&maxheight=${maxHeight}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  // Find nearby Google Places for a tourist spot and get their images
  findNearbyGooglePlaces(spotName: string, lat: number, lng: number): Observable<any> {
    // First search for the exact place name
    return this.searchPlaceByName(spotName, lat, lng).pipe(
      tap((searchResult: any) => {
        if (searchResult.results && searchResult.results.length > 0) {
        } else {
          }
      })
    );
  }
}
