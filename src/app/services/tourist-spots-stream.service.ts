import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';

const TOURIST_SPOTS_CACHE_KEY = 'tourist_spots_cache';

/**
 * Firestore stream + localStorage cache for tourist_spots (map search + segment name matching).
 */
@Injectable({
  providedIn: 'root',
})
export class TouristSpotsStreamService {
  /** Hydrate from disk when the in-memory list is still empty. */
  readCachedSpotsWhenEmpty(currentSpotCount: number): any[] | null {
    if (currentSpotCount > 0) {
      return null;
    }
    const cached = localStorage.getItem(TOURIST_SPOTS_CACHE_KEY);
    if (!cached) {
      return null;
    }
    try {
      return JSON.parse(cached) as any[];
    } catch {
      return null;
    }
  }

  readCachedSpotsOrEmpty(): any[] {
    const cached = localStorage.getItem(TOURIST_SPOTS_CACHE_KEY);
    if (!cached) {
      return [];
    }
    try {
      return JSON.parse(cached) as any[];
    } catch {
      return [];
    }
  }

  persistCache(spots: any[]): void {
    try {
      localStorage.setItem(TOURIST_SPOTS_CACHE_KEY, JSON.stringify(spots));
    } catch {
      // ignore quota / private mode
    }
  }

  clearDiskCache(): void {
    try {
      localStorage.removeItem(TOURIST_SPOTS_CACHE_KEY);
    } catch {
      // ignore
    }
  }

  watchSpots(firestore: AngularFirestore): Observable<any[]> {
    return firestore.collection('tourist_spots').valueChanges({ idField: 'id' });
  }
}
