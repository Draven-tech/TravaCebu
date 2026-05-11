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

  constructor(private http: HttpClient, private apiTracker: ApiTrackerService) { }

  getHiddenGems(spots: any[], maxItems: number = 6): any[] {
    if (!Array.isArray(spots) || spots.length === 0) {
      return [];
    }

    const spotsWithVolume = spots
      .filter(spot => Boolean(spot?.id))
      .map(spot => ({
        ...spot,
        userRatingsTotal: Number(spot?.userRatingsTotal ?? 0)
      }))
      .sort((a, b) => a.userRatingsTotal - b.userRatingsTotal);

    if (spotsWithVolume.length === 0) {
      return [];
    }

    const hiddenGemPoolSize = Math.max(1, Math.ceil(spotsWithVolume.length / 3));
    return spotsWithVolume.slice(0, hiddenGemPoolSize).slice(0, maxItems);
  }

  testApiKey(): Observable<any> {
    const testParams = {
      location: '10.3157,123.8854', // Cebu City coordinates
      radius: '1000',
      type: 'restaurant',
      key: this.apiKey
    };

    return this.http.get(this.proxyUrl, { params: testParams }).pipe(
      catchError(error => {
        console.error('API key test failed:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  getNearbyPlaces(lat: number, lng: number, type: string, radius: number = 1000): Observable<any> {
    this.apiTracker.logApiCall('places', type, { lat, lng }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      location: `${lat},${lng}`,
      radius: radius.toString(),
      type,
      key: this.apiKey
    };

    const apiUrl = this.proxyUrl;

    return this.http.get(apiUrl, { params }).pipe(
      tap((resp: any) => {
      }),
      catchError(error => {
        console.error('Error fetching places:', error);
        console.error('Error details:', error.status, error.statusText, error.error);
        return new Observable(observer => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  /**
   * Minimal Place Details for emergency / contact UI (phone, maps URL, website).
   */
  getPlaceContactDetails(placeId: string): Observable<any> {
    this.apiTracker.logApiCall('places', 'details_contact', { placeId }).catch((err) => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      place_id: placeId,
      fields:
        'name,formatted_address,formatted_phone_number,international_phone_number,geometry,url,website',
      key: this.apiKey,
    };

    const detailsUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/details';

    return this.http.get(detailsUrl, { params }).pipe(
      catchError((error) => {
        console.error('Error fetching place contact details:', error);
        return new Observable((observer) => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  getPlaceDetails(placeId: string): Observable<any> {
    this.apiTracker.logApiCall('places', 'details', { placeId }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      place_id: placeId,
      fields: 'name,formatted_address,geometry,photos,types,rating,user_ratings_total,opening_hours',
      key: this.apiKey
    };

    const detailsUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/details';

    return this.http.get(detailsUrl, { params }).pipe(
      tap((resp: any) => {
      }),
      catchError(error => {
        console.error('Error fetching place details:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  getPlacePhotos(placeId: string, maxPhotos: number = 5): Observable<any> {
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
        console.error('Error fetching place photos:', error);
        return new Observable(observer => {
          observer.next({ status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  /**
   * Text Search biased to a location (e.g. embassy fallback when Nearby returns nothing).
   */
  searchTextNear(query: string, lat: number, lng: number, radius: number = 30000): Observable<any> {
    this.apiTracker.logApiCall('places', 'textsearch_near', { query, lat, lng }).catch((err) => {
      console.error('Failed to log API call:', err);
    });

    const params = {
      query,
      location: `${lat},${lng}`,
      radius: String(radius),
      key: this.apiKey,
    };

    const searchUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/textsearch';

    return this.http.get(searchUrl, { params }).pipe(
      catchError((error) => {
        console.error('Error in text search near:', error);
        return new Observable((observer) => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  searchPlaceByName(name: string, lat: number, lng: number): Observable<any> {
    this.apiTracker.logApiCall('places', 'textsearch', { name, lat, lng }).catch(err => {
      console.error('Failed to log API call:', err);
    });

    const cebuLat = 10.3157;
    const cebuLng = 123.8854;

    const params = {
      query: `${name} Cebu Philippines`,
      location: `${cebuLat},${cebuLng}`,
      radius: '30000',
      key: this.apiKey
    };

    const searchUrl = 'https://google-places-proxy-ftxx.onrender.com/api/place/textsearch';

    return this.http.get(searchUrl, { params }).pipe(
      tap((searchResult: any) => {
      }),
      map((searchResult: any) => {
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
        console.error('Error searching place:', error);
        return new Observable(observer => {
          observer.next({ results: [], status: 'ERROR', error: error.message });
          observer.complete();
        });
      })
    );
  }

  getPhotoUrl(photoReference: string, maxWidth: number = 400, maxHeight: number = 300): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&maxheight=${maxHeight}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  findNearbyGooglePlaces(spotName: string, lat: number, lng: number): Observable<any> {
    return this.searchPlaceByName(spotName, lat, lng).pipe(
      tap((searchResult: any) => {
        if (searchResult.results && searchResult.results.length > 0) {
        } else {
        }
      })
    );
  }
}
