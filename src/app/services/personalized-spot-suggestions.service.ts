import { Injectable } from '@angular/core';

export interface SpotLocation {
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root'
})
export class PersonalizedSpotSuggestionsService {
  private readonly RADIUS_KM = 10;

  private readonly profilePreferenceKeys = [
    'preferredCategories',
    'preferredSpotCategories',
    'categoryPreferences',
    'travelPreferences',
    'interests',
    'favoriteCategories'
  ];

  getPersonalizedSuggestions(
    allSpots: any[],
    _visitedSpots: any[],
    userData: any,
    limit: number = 6,
    userLocation?: SpotLocation
  ): any[] {
    if (!Array.isArray(allSpots) || allSpots.length === 0) {
      return [];
    }

    const preferredCategories = this.extractPreferredCategories(userData);
    const preferredCategorySet = new Set(preferredCategories);

    const candidates = allSpots
      .filter(spot => Boolean(spot?.id))
      .map(spot => ({
        ...spot,
        distanceKm: userLocation ? this.distanceKm(userLocation, spot?.location) : null
      }))
      .filter(spot => {
        if (!userLocation) return true;
        return spot.distanceKm !== null && spot.distanceKm <= this.RADIUS_KM;
      });

    candidates.sort((a, b) => {
      // Primary: distance ascending (closest first)
      if (userLocation) {
        const distDiff = (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        if (distDiff !== 0) return distDiff;
      }

      // Secondary: preferred category
      const aPreferred = preferredCategorySet.has(this.normalizeCategory(a.category)) ? 1 : 0;
      const bPreferred = preferredCategorySet.has(this.normalizeCategory(b.category)) ? 1 : 0;
      if (bPreferred !== aPreferred) return bPreferred - aPreferred;

      // Tertiary: popularity
      return Number(b?.userRatingsTotal || 0) - Number(a?.userRatingsTotal || 0);
    });

    return candidates.slice(0, limit);
  }

  getSpotsWithinRadius(allSpots: any[], userLocation: SpotLocation): any[] {
    return allSpots
      .filter(spot => Boolean(spot?.id))
      .map(spot => ({
        ...spot,
        distanceKm: this.distanceKm(userLocation, spot?.location)
      }))
      .filter(spot => spot.distanceKm !== null && spot.distanceKm <= this.RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  extractPreferredCategories(userData: any): string[] {
    if (!userData || typeof userData !== 'object') {
      return [];
    }

    const categories = new Set<string>();

    for (const key of this.profilePreferenceKeys) {
      const value = userData[key];

      if (Array.isArray(value)) {
        value.forEach(category => {
          const normalized = this.normalizeCategory(category);
          if (normalized) categories.add(normalized);
        });
        continue;
      }

      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([rawCategory, enabled]) => {
          if (!enabled) return;
          const normalized = this.normalizeCategory(rawCategory);
          if (normalized) categories.add(normalized);
        });
      }
    }

    return Array.from(categories);
  }

  getEffectiveSuggestionCategories(visitedSpots: any[], userData: any): string[] {
    const preferred = this.extractPreferredCategories(userData);
    if (preferred.length > 0) return preferred;

    const scores = this.buildVisitedCategoryScores(visitedSpots);
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
  }

  private distanceKm(a: SpotLocation, b: any): number | null {
    if (typeof b?.lat !== 'number' || typeof b?.lng !== 'number') return null;
    const dLat = (b.lat - a.lat) * 111;
    const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  private buildVisitedCategoryScores(visitedSpots: any[]): Map<string, number> {
    const scores = new Map<string, number>();
    (visitedSpots || []).forEach((spot, index) => {
      const category = this.normalizeCategory(spot?.category);
      if (!category) return;
      const recencyWeight = Math.max(1, 4 - Math.floor(index / 3));
      scores.set(category, (scores.get(category) || 0) + recencyWeight);
    });
    return scores;
  }

  private normalizeCategory(category: any): string {
    if (!category) return '';
    const normalized = String(category).trim().toLowerCase();
    const aliases: Record<string, string> = {
      attractions: 'attraction',
      malls: 'mall',
      beaches: 'beach',
      landmarks: 'landmark',
      museums: 'museum',
      parks: 'park'
    };
    return aliases[normalized] || normalized;
  }
}
