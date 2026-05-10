import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { ItineraryDay, ItinerarySpot } from './itinerary.service';
import { WeatherService, WeatherSummaryBlock } from './weather.service';
import { exposureFromGooglePlaceTypes } from '../utils/spot-exposure.util';

export type Exposure = 'indoor' | 'mixed' | 'outdoor';

export interface WeatherSuggestionResult {
  alternatives: any[];
  /** Plain string (e.g. toast, logs, or simple fallback UI). */
  summary: string;
  /** Structured copy for the itinerary modal when present. */
  summaryBlock?: WeatherSummaryBlock;
  skipReason?: 'not_outdoor' | 'weather_ok' | 'no_forecast';
}

@Injectable({ providedIn: 'root' })
export class WeatherSpotSuggestionsService {
  private allSpotsPromise: Promise<any[]> | null = null;

  constructor(
    private firestore: AngularFirestore,
    private weatherService: WeatherService
  ) {}

  /**
   * Optional Firestore field `exposure` on `tourist_spots`.
   * Then `googlePlaceTypes` from Places sync; otherwise infer from category / name.
   */
  inferExposure(spot: any): Exposure {
    const raw = (spot?.exposure || spot?.Exposure || '').toString().toLowerCase();
    if (raw === 'indoor' || raw === 'outdoor' || raw === 'mixed') {
      return raw as Exposure;
    }
    const gpTypes = spot?.googlePlaceTypes ?? spot?.google_place_types;
    if (Array.isArray(gpTypes) && gpTypes.length > 0) {
      return exposureFromGooglePlaceTypes(gpTypes);
    }
    const cat = `${spot?.category || ''} ${spot?.name || ''}`.toLowerCase();

    if (/(museum|mall|gallery|theater|theatre|cinema|indoor|shopping|spa|food\s*court)/.test(cat)) {
      return 'indoor';
    }
    if (/(beach|viewpoint|view point|trail|hiking|peak|island|snorkel|dive|park\b|plaza|outdoor|lookout|waterfall)/.test(cat)) {
      return 'outdoor';
    }
    return 'mixed';
  }

  isMostlyOutdoor(spot: any): boolean {
    return this.inferExposure(spot) === 'outdoor';
  }

  private haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const lat1 = this.toRad(a.lat);
    const lat2 = this.toRad(b.lat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }

  private toRad(n: number): number {
    return (n * Math.PI) / 180;
  }

  async loadAllTouristSpots(): Promise<any[]> {
    if (!this.allSpotsPromise) {
      this.allSpotsPromise = this.firestore
        .collection('tourist_spots')
        .get()
        .toPromise()
        .then((snap) =>
          (snap?.docs || []).map((doc) => ({
            id: doc.id,
            ...(doc.data() as Record<string, unknown>)
          }))
        );
    }
    return this.allSpotsPromise;
  }

  collectItinerarySpotIds(itinerary: ItineraryDay[]): Set<string> {
    const ids = new Set<string>();
    for (const day of itinerary) {
      for (const spot of day.spots) {
        const id = spot.touristSpotId || spot.spotId || spot.id;
        if (id) {
          ids.add(id);
        }
      }
    }
    return ids;
  }

  /**
   * On-demand: forecast at spot + time for open-air stops; if poor, indoor/mixed alternatives from Firestore.
   */
  async getWeatherAwareAlternatives(
    spot: ItinerarySpot,
    dayDate: string | undefined,
    itinerary: ItineraryDay[],
    limit = 6
  ): Promise<WeatherSuggestionResult> {
    if (!this.isMostlyOutdoor(spot)) {
      return {
        alternatives: [],
        summary: '',
        skipReason: 'not_outdoor',
      };
    }

    if (!dayDate || !spot.timeSlot) {
      return {
        alternatives: [],
        summary: 'Set a date and time for this stop to check weather.',
        skipReason: 'no_forecast',
      };
    }

    const visit = this.weatherService.visitDateTime(dayDate, spot.timeSlot);
    if (!visit) {
      return {
        alternatives: [],
        summary: 'Could not read date/time for this stop.',
        skipReason: 'no_forecast',
      };
    }

    const forecast = await firstValueFrom(
      this.weatherService.getHourlyForecast(spot.location.lat, spot.location.lng, 240)
    );

    const hour = this.weatherService.pickClosestForecastHour(forecast, visit);
    const summaryLine = this.weatherService.formatHourSummary(hour);
    const okBlock = this.weatherService.buildOutdoorOkBlock(hour);

    if (!this.weatherService.isUncomfortableOutdoor(hour)) {
      return {
        alternatives: [],
        summary: summaryLine ? `Forecast at visit time: ${summaryLine}` : okBlock.headline,
        summaryBlock: okBlock,
        skipReason: 'weather_ok',
      };
    }

    const booked = this.collectItinerarySpotIds(itinerary);
    const all = await this.loadAllTouristSpots();

    const origin = spot.location;
    const candidates = all
      .filter((s) => {
        const id = s.id;
        if (!id || booked.has(id)) {
          return false;
        }
        const exp = this.inferExposure(s);
        if (exp === 'outdoor') {
          return false;
        }
        if (!s.location || typeof s.location.lat !== 'number' || typeof s.location.lng !== 'number') {
          return false;
        }
        return true;
      })
      .map((s) => ({
        ...s,
        _distanceKm: this.haversineKm(origin, s.location)
      }))
      .sort((a, b) => a._distanceKm - b._distanceKm)
      .slice(0, limit);

    const block = this.weatherService.buildOutdoorConcernBlock(hour);
    const compactSummary = [block.headline, ...block.bullets, block.footer || '']
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      alternatives: candidates,
      summary: compactSummary,
      summaryBlock: block,
    };
  }
}
