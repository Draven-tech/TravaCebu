import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AdminAuthService } from './admin-auth.service';

const TC_PLACES_PROXY = 'https://google-places-proxy-ftxx.onrender.com';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly authSvc = inject(AdminAuthService);

  private optionalKeyQs(): string {
    const key = environment.keys.googleMapsApiKey?.trim();
    return key ? `&key=${encodeURIComponent(key)}` : '';
  }

  private async placesJson(url: string): Promise<unknown> {
    const r = await fetch(url);
    const text = await r.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      console.warn('places JSON parse failed', url, text.slice(0, 160));
      return { status: 'PARSE_ERROR', error: text.slice(0, 200), httpStatus: r.status };
    }
  }

  async textSearch(name: string): Promise<{ status?: string; results?: unknown[] }> {
    const q = encodeURIComponent(`${name} Cebu Philippines`);
    let u =
      `${TC_PLACES_PROXY}/api/place/textsearch?query=${q}` +
      `&location=${encodeURIComponent('10.3157,123.8854')}&radius=30000`;
    u += this.optionalKeyQs();
    const j = (await this.placesJson(u)) as { status?: string; results?: unknown[] };
    void this.authSvc.logApiCall('places', 'textsearch', { query: name });
    return j;
  }

  async details(
    placeId: string,
    fields?: string,
  ): Promise<{ status?: string; result?: Record<string, unknown> }> {
    const f = encodeURIComponent(
      fields ??
        'name,formatted_address,geometry,photos,types,rating,user_ratings_total,opening_hours',
    );
    let u = `${TC_PLACES_PROXY}/api/place/details?place_id=${encodeURIComponent(placeId)}&fields=${f}`;
    u += this.optionalKeyQs();
    const j = (await this.placesJson(u)) as { status?: string; result?: Record<string, unknown> };
    void this.authSvc.logApiCall('places', 'details', { place_id: placeId });
    return j;
  }

  photoUrlFromReference(photoRef: string, maxW?: number, maxH?: number): string {
    const key = environment.keys.googleMapsApiKey ?? '';
    if (!key || !photoRef) return '';
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxW ?? 400}&maxheight=${maxH ?? 300}&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(key)}`;
  }
}
