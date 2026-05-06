import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PersonalizedSpotSuggestionsService {
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
    visitedSpots: any[],
    userData: any,
    limit: number = 6
  ): any[] {
    if (!Array.isArray(allSpots) || allSpots.length === 0) {
      return [];
    }

    const visitedSpotIds = this.buildVisitedSpotIdSet(visitedSpots);
    const visitedCategoryScores = this.buildVisitedCategoryScores(visitedSpots);
    const preferredCategories = this.extractPreferredCategories(userData);
    const preferredCategorySet = new Set(preferredCategories);

    const ranked = allSpots
      .filter((spot) => Boolean(spot?.id) && !visitedSpotIds.has(spot.id))
      .map((spot) => {
        const normalizedCategory = this.normalizeCategory(spot?.category);
        const popularity =
          Number(spot?.userRatingsTotal || 0) * 0.01 + Number(spot?.rating || 0) * 0.5;

        const preferredCategoryBoost = preferredCategorySet.has(normalizedCategory) ? 6 : 0;
        const visitedCategoryBoost = visitedCategoryScores.get(normalizedCategory) || 0;
        const totalScore = preferredCategoryBoost + visitedCategoryBoost + popularity;

        return {
          ...spot,
          recommendationScore: totalScore
        };
      })
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore;
        }
        return Number(b?.userRatingsTotal || 0) - Number(a?.userRatingsTotal || 0);
      });

    return ranked.slice(0, limit);
  }

  extractPreferredCategories(userData: any): string[] {
    if (!userData || typeof userData !== 'object') {
      return [];
    }

    const categories = new Set<string>();

    for (const key of this.profilePreferenceKeys) {
      const value = userData[key];

      if (Array.isArray(value)) {
        value.forEach((category) => {
          const normalized = this.normalizeCategory(category);
          if (normalized) {
            categories.add(normalized);
          }
        });
        continue;
      }

      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([rawCategory, enabled]) => {
          if (!enabled) {
            return;
          }
          const normalized = this.normalizeCategory(rawCategory);
          if (normalized) {
            categories.add(normalized);
          }
        });
      }
    }

    return Array.from(categories);
  }

  getEffectiveSuggestionCategories(visitedSpots: any[], userData: any): string[] {
    const preferred = this.extractPreferredCategories(userData);
    if (preferred.length > 0) {
      return preferred;
    }

    const visitedCategoryScores = this.buildVisitedCategoryScores(visitedSpots);
    return Array.from(visitedCategoryScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
  }

  private buildVisitedSpotIdSet(visitedSpots: any[]): Set<string> {
    const ids = new Set<string>();
    (visitedSpots || []).forEach((spot) => {
      if (spot?.spotId) {
        ids.add(String(spot.spotId));
      }
      if (spot?.id) {
        ids.add(String(spot.id));
      }
    });
    return ids;
  }

  private buildVisitedCategoryScores(visitedSpots: any[]): Map<string, number> {
    const scores = new Map<string, number>();

    (visitedSpots || []).forEach((spot, index) => {
      const normalizedCategory = this.normalizeCategory(spot?.category);
      if (!normalizedCategory) {
        return;
      }

      // Give more weight to more recent visited spots.
      const recencyWeight = Math.max(1, 4 - Math.floor(index / 3));
      scores.set(normalizedCategory, (scores.get(normalizedCategory) || 0) + recencyWeight);
    });

    return scores;
  }

  private normalizeCategory(category: any): string {
    if (!category) {
      return '';
    }

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
