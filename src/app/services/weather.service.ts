import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** One hour block from Weather API `forecast.hours` response */
export interface WeatherForecastHour {
  interval?: { startTime?: string; endTime?: string };
  weatherCondition?: { type?: string; description?: { text?: string } };
  precipitation?: {
    probability?: { percent?: number; type?: string };
  };
  thunderstormProbability?: number;
}

export interface HourlyForecastResult {
  forecastHours?: WeatherForecastHour[];
  timeZone?: { id?: string };
}

/** Readable block for itinerary UI (outdoor-stop weather warning). */
export interface WeatherSummaryBlock {
  headline: string;
  bullets: string[];
  footer?: string;
}

/**
 * Fetches hourly forecasts via the same proxy host as Places (keep API key server-side in production proxy).
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  /** Match `places.service` / deploy your proxy with `/api/weather/hourly` */
  private readonly defaultProxyBase = 'https://google-places-proxy-ftxx.onrender.com';

  /** In-memory cache: rounded(lat,lng)_hours -> observable — works per session only. Future: persisted cache (TTL / per-day key) to trim API calls while keeping forecasts fresh. */
  private cache = new Map<string, Observable<HourlyForecastResult | null>>();

  constructor(private http: HttpClient) {}

  private proxyBaseUrl(): string {
    const base = (environment as { mapsProxyBase?: string }).mapsProxyBase;
    return (typeof base === 'string' && base.length > 0 ? base : this.defaultProxyBase).replace(/\/$/, '');
  }

  getHourlyForecast(lat: number, lng: number, hours = 120): Observable<HourlyForecastResult | null> {
    const key = `${lat.toFixed(3)}_${lng.toFixed(3)}_${hours}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const url = `${this.proxyBaseUrl()}/api/weather/hourly`;
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lng', String(lng))
      .set('hours', String(hours))
      .set('key', environment.googleMapsApiKey);

    const req$ = this.http.get<HourlyForecastResult>(url, { params }).pipe(
      catchError((err) => {
        console.error('[WeatherService] hourly forecast failed', err);
        return of(null);
      }),
      shareReplay(1)
    );

    this.cache.set(key, req$);
    return req$;
  }

  /** Pick the forecast hour closest to the planned visit instant (PH-local wall time encoded in visit). */
  pickClosestForecastHour(forecast: HourlyForecastResult | null, visitUtc: Date): WeatherForecastHour | null {
    const hours = forecast?.forecastHours;
    if (!hours?.length) {
      return null;
    }

    let best: WeatherForecastHour | null = null;
    let bestDiff = Infinity;
    const t = visitUtc.getTime();

    for (const h of hours) {
      const start = h.interval?.startTime ? new Date(h.interval.startTime).getTime() : NaN;
      if (isNaN(start)) {
        continue;
      }
      const diff = Math.abs(t - start);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = h;
      }
    }
    return best;
  }

  /**
   * Heuristic: uncomfortable for open-air activities when rain risk or storms are elevated.
   * Tune thresholds with product after field testing in Cebu.
   */
  isUncomfortableOutdoor(hour: WeatherForecastHour | null): boolean {
    if (!hour) {
      return false;
    }
    const p = hour.precipitation?.probability?.percent ?? 0;
    const thunder = hour.thunderstormProbability ?? 0;
    const wxType = (hour.weatherCondition?.type || '').toUpperCase();
    const wetTypes = /RAIN|STORM|THUNDER|DRIZZLE|SHOWERS|SLEET|HAIL|SNOW/;
    return p >= 40 || thunder >= 25 || wetTypes.test(wxType);
  }

  formatHourSummary(hour: WeatherForecastHour | null): string {
    if (!hour) {
      return '';
    }
    const desc = hour.weatherCondition?.description?.text || hour.weatherCondition?.type || 'Forecast';
    const p = hour.precipitation?.probability?.percent;
    const thunder = hour.thunderstormProbability;
    const parts = [desc];
    if (typeof p === 'number') {
      parts.push(`Rain ~${p}%`);
    }
    if (typeof thunder === 'number' && thunder > 0) {
      parts.push(`Thunder ~${thunder}%`);
    }
    return parts.join(' · ');
  }

  /**
   * User-facing explanation when an outdoor stop hits uncomfortable thresholds.
   * (API may say “partly sunny” while rain/thunder probability is still high.)
   */
  buildOutdoorConcernBlock(hour: WeatherForecastHour | null): WeatherSummaryBlock {
    if (!hour) {
      return {
        headline: 'We could not match this stop’s time to an hourly forecast.',
        bullets: [],
        footer: 'You can still open suggestions below or check another weather source.',
      };
    }
    const desc = (hour.weatherCondition?.description?.text || hour.weatherCondition?.type || '').trim() || 'No short description';
    const p = hour.precipitation?.probability?.percent;
    const thunder = hour.thunderstormProbability ?? 0;
    const bullets: string[] = [
      `General conditions: ${desc}.`,
    ];
    if (typeof p === 'number') {
      bullets.push(`Chance of rain (this hour): about ${p}%.`);
    }
    if (thunder > 0) {
      bullets.push(`Thunder / lightning risk: about ${thunder}%.`);
    }
    return {
      headline:
        'This attraction is mostly outdoors. For your planned visit time, the forecast shows enough rain or storm risk that staying outside may be uncomfortable.',
      bullets,
      footer:
        'Pick a nearby indoor or mixed indoor/outdoor place below and tap Replace Spot to swap it in. Your visit time stays the same.',
    };
  }

  /** Short friendly lines when conditions are OK for outdoor stops. */
  buildOutdoorOkBlock(hour: WeatherForecastHour | null): WeatherSummaryBlock {
    const summary = this.formatHourSummary(hour);
    return {
      headline: summary ? `Forecast at your visit time: ${summary}` : 'Conditions look reasonable for outdoor plans.',
      bullets: [],
      footer: 'No indoor alternatives are suggested.',
    };
  }

  /** Parse day.date (YYYY-MM-DD) + timeSlot (HH:mm) as a Date in Asia/Manila. */
  visitDateTime(dayDate: string, timeSlot: string): Date | null {
    if (!dayDate || !timeSlot) {
      return null;
    }
    const [y, mo, d] = dayDate.split('-').map(Number);
    const [hh, mm] = timeSlot.split(':').map(Number);
    if (!y || !mo || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
      return null;
    }
    // Cebu / PH — fixed offset avoids missing TZ in some environments
    return new Date(Date.UTC(y, mo - 1, d, hh - 8, mm, 0, 0));
  }

  /** Clear cache (e.g. after long idle) — optional */
  clearCache(): void {
    this.cache.clear();
  }
}
