import { Injectable } from '@angular/core';
import { PlacesService } from './places.service';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

export interface PlaceImage {
  url: string;
  width: number;
  height: number;
  photoReference: string;
  isGooglePlace: boolean;
}

export interface EnhancedTouristSpot {
  id: string;
  name: string;
  description: string;
  category: string;
  location: {
    lat: number;
    lng: number;
  };
  img?: string; // Custom image URL
  googlePlaceId?: string;
  googleImages?: PlaceImage[];
  googleRating?: number;
  googleUserRatings?: number;
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class PlacesImageService {
  private imageCache = new Map<string, PlaceImage[]>();

  constructor(private placesService: PlacesService) {}

  // Test method to verify Google Places integration
  testGooglePlacesIntegration(): Observable<any> {
    console.log('🧪 Testing Google Places integration...');
    
    // Test with a known place in Cebu
    const testSpot = {
      id: 'test',
      name: 'SM City Cebu',
      description: 'Shopping mall in Cebu City',
      category: 'mall',
      location: {
        lat: 10.3157,
        lng: 123.8854
      }
    };

    return this.enhanceTouristSpot(testSpot).pipe(
      map(enhancedSpot => {
        console.log('✅ Google Places integration test result:', enhancedSpot);
        return {
          success: true,
          enhancedSpot,
          hasGoogleImages: enhancedSpot.googleImages && enhancedSpot.googleImages.length > 0,
          hasGoogleRating: !!enhancedSpot.googleRating
        };
      }),
      catchError(error => {
        console.error('❌ Google Places integration test failed:', error);
        return of({
          success: false,
          error: error.message
        });
      })
    );
  }

  // Enhance a tourist spot with Google Places images
  enhanceTouristSpot(spot: any): Observable<EnhancedTouristSpot> {
    const enhancedSpot: EnhancedTouristSpot = {
      ...spot,
      googleImages: []
    };

    // If we already have Google images cached, return them
    if (this.imageCache.has(spot.id)) {
      enhancedSpot.googleImages = this.imageCache.get(spot.id) || [];
      return of(enhancedSpot);
    }

    // Try to find Google Places data for this spot
    return this.findGooglePlaceForSpot(spot).pipe(
      switchMap(googlePlace => {
        if (googlePlace && googlePlace.place_id) {
          enhancedSpot.googlePlaceId = googlePlace.place_id;
          enhancedSpot.googleRating = googlePlace.rating;
          enhancedSpot.googleUserRatings = googlePlace.user_ratings_total;

          // Get photos for this place
          return this.placesService.getPlacePhotos(googlePlace.place_id).pipe(
            map((photoResult: any) => {
              if (photoResult.result && photoResult.result.photos) {
                const photos = photoResult.result.photos.slice(0, 5); // Limit to 5 photos
                const googleImages = photos.map((photo: any) => ({
                  url: this.placesService.getPhotoUrl(photo.photo_reference),
                  width: photo.width || 400,
                  height: photo.height || 300,
                  photoReference: photo.photo_reference,
                  isGooglePlace: true
                }));
                
                enhancedSpot.googleImages = googleImages;
                
                // Cache the images
                this.imageCache.set(spot.id, googleImages);
              }
              return enhancedSpot;
            }),
            catchError(error => {
              console.error('Error fetching place photos:', error);
              return of(enhancedSpot);
            })
          );
        } else {
          // Fallback: Try to find a matching place using simple name matching
          return this.findFallbackGooglePlace(spot).pipe(
            map(fallbackPlace => {
              if (fallbackPlace) {
                enhancedSpot.googlePlaceId = fallbackPlace.place_id;
                enhancedSpot.googleRating = fallbackPlace.rating;
                enhancedSpot.googleUserRatings = fallbackPlace.user_ratings_total;
              }
              return enhancedSpot;
            }),
            catchError(error => {
              console.error('Error in fallback place search:', error);
              return of(enhancedSpot);
            })
          );
        }
      }),
      catchError(error => {
        console.error('Error enhancing tourist spot:', error);
        return of(enhancedSpot);
      })
    );
  }

  // Fallback method for when proxy server is down
  private findFallbackGooglePlace(spot: any): Observable<any> {
    // Simple fallback: try to find places with similar names in Cebu
    const searchTerms = [
      spot.name,
      spot.name.replace(/[^\w\s]/g, ''), // Remove special characters
      spot.name.split(' ')[0], // First word
      spot.name.split(' ').slice(0, 2).join(' ') // First two words
    ];

    // Try each search term
    return new Observable(observer => {
      let attempts = 0;
      const maxAttempts = searchTerms.length;

      const tryNextSearch = () => {
        if (attempts >= maxAttempts) {
          observer.next(null);
          observer.complete();
          return;
        }

        const searchTerm = searchTerms[attempts];
        attempts++;

        this.placesService.searchPlaceByName(searchTerm, 10.3157, 123.8854).subscribe({
          next: (result: any) => {
            if (result.results && result.results.length > 0) {
              const bestMatch = this.findBestMatch(spot.name, result.results);
              if (bestMatch && bestMatch.similarity > 0.3) {
                observer.next(bestMatch);
                observer.complete();
              } else {
                tryNextSearch();
              }
            } else {
              tryNextSearch();
            }
          },
          error: (error: any) => {
            console.error(`Fallback search attempt ${attempts} failed:`, error);
            tryNextSearch();
          }
        });
      };

      tryNextSearch();
    });
  }

  // Find Google Place for a tourist spot
  private findGooglePlaceForSpot(spot: any): Observable<any> {
    if (!spot.name || !spot.location) {
      return of(null);
    }

    return this.placesService.searchPlaceByName(
      spot.name,
      spot.location.lat,
      spot.location.lng
    ).pipe(
      map((searchResult: any) => {
        if (searchResult.results && searchResult.results.length > 0) {
          // Find the best match based on name similarity and distance
          const bestMatch = this.findBestMatch(spot.name, searchResult.results);
          return bestMatch;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error searching for Google Place:', error);
        // Return null instead of throwing to allow graceful fallback
        return of(null);
      })
    );
  }

  // Find the best matching Google Place
  private findBestMatch(spotName: string, googlePlaces: any[]): any {
    const normalizedSpotName = spotName.toLowerCase().replace(/[^\w\s]/g, '');
    
    return googlePlaces.reduce((best, current) => {
      const normalizedGoogleName = current.name.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Calculate similarity score
      const similarity = this.calculateSimilarity(normalizedSpotName, normalizedGoogleName);
      
      if (!best || similarity > best.similarity) {
        return { ...current, similarity };
      }
      
      return best;
    }, null);
  }

  // Calculate string similarity (simple implementation)
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // Get the best image for a tourist spot (custom image first, then Google image)
  getBestImage(spot: EnhancedTouristSpot): string {
    // Return custom image if available
    if (spot.img) {
      return spot.img;
    }
    
    // Return first Google image if available
    if (spot.googleImages && spot.googleImages.length > 0) {
      return spot.googleImages[0].url;
    }
    
    // Return default placeholder
    return 'assets/img/default.png';
  }

  // Get all images for a tourist spot
  getAllImages(spot: EnhancedTouristSpot): PlaceImage[] {
    const images: PlaceImage[] = [];
    
    // Add custom image if available
    if (spot.img) {
      images.push({
        url: spot.img,
        width: 400,
        height: 300,
        photoReference: '',
        isGooglePlace: false
      });
    }
    
    // Add Google images
    if (spot.googleImages) {
      images.push(...spot.googleImages);
    }
    
    return images;
  }

  // Clear image cache
  clearCache(): void {
    this.imageCache.clear();
  }

  // Clear specific spot cache
  clearSpotCache(spotId: string): void {
    this.imageCache.delete(spotId);
  }
} 