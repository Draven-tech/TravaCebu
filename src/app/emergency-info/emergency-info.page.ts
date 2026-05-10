import { Component } from '@angular/core';
import {
  ActionSheetController,
  LoadingController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { LocationTrackingService } from '../services/location-tracking.service';
import { PlacesService } from '../services/places.service';
import { MapFocusIntentService } from '../services/map-focus-intent.service';

const NEARBY_RADIUS_M = 8000;
const EMBASSY_NEARBY_RETRY_RADIUS_M = 25000;

export interface EmergencyPlaceRow {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  lat?: number;
  lng?: number;
}

@Component({
  standalone: false,
  selector: 'app-emergency-info',
  templateUrl: './emergency-info.page.html',
  styleUrls: ['./emergency-info.page.scss'],
})
export class EmergencyInfoPage {
  segment: 'hospital' | 'police' | 'embassy' = 'hospital';

  hospitals: EmergencyPlaceRow[] = [];
  police: EmergencyPlaceRow[] = [];
  embassies: EmergencyPlaceRow[] = [];

  loadingHospitals = false;
  loadingPolice = false;
  loadingEmbassy = false;

  embassyFallbackMessage: string | null = null;

  /** Filter list by name or address (directions search). */
  emergencySearchQuery = '';

  lat = 10.3157;
  lng = 123.8854;
  locationLabel = 'Cebu area (default)';

  constructor(
    private navCtrl: NavController,
    private locationTracking: LocationTrackingService,
    private placesService: PlacesService,
    private mapFocusIntent: MapFocusIntentService,
    private actionSheetCtrl: ActionSheetController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter() {
    void this.loadAll();
  }

  goBack() {
    this.navCtrl.back();
  }

  async handleRefresh(event: { target: { complete: () => void } }) {
    try {
      await this.loadAll();
    } finally {
      event.target.complete();
    }
  }

  get currentList(): EmergencyPlaceRow[] {
    switch (this.segment) {
      case 'police':
        return this.police;
      case 'embassy':
        return this.embassies;
      default:
        return this.hospitals;
    }
  }

  get currentLoading(): boolean {
    switch (this.segment) {
      case 'police':
        return this.loadingPolice;
      case 'embassy':
        return this.loadingEmbassy;
      default:
        return this.loadingHospitals;
    }
  }

  get filteredCurrentList(): EmergencyPlaceRow[] {
    const list = this.currentList;
    const q = (this.emergencySearchQuery || '').trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.vicinity || '').toLowerCase().includes(q)
    );
  }

  async loadAll() {
    const loc = await this.locationTracking.getLocationWithFallback();
    this.lat = loc.lat;
    this.lng = loc.lng;
    this.locationLabel = loc.isReal ? 'Near your location' : 'Cebu area (approximate)';

    void this.loadHospitals();
    void this.loadPolice();
    void this.loadEmbassies();
  }

  private mapNearbyResults(resp: any): EmergencyPlaceRow[] {
    const results = resp?.results;
    if (!Array.isArray(results)) {
      return [];
    }
    return results.map((p: any) => {
      const plat = p.geometry?.location?.lat;
      const plng = p.geometry?.location?.lng;
      return {
        place_id: p.place_id,
        name: p.name,
        vicinity: p.vicinity || p.formatted_address,
        rating: typeof p.rating === 'number' ? p.rating : undefined,
        lat: typeof plat === 'number' ? plat : undefined,
        lng: typeof plng === 'number' ? plng : undefined,
      };
    });
  }

  private async loadHospitals() {
    this.loadingHospitals = true;
    try {
      const resp = await firstValueFrom(
        this.placesService.getNearbyPlaces(this.lat, this.lng, 'hospital', NEARBY_RADIUS_M)
      );
      this.hospitals = this.mapNearbyResults(resp);
      if (resp?.status && resp.status !== 'OK' && resp.status !== 'ZERO_RESULTS') {
        await this.toastShort('Could not load hospitals. Try again later.');
      }
    } catch {
      this.hospitals = [];
      await this.toastShort('Could not load hospitals.');
    } finally {
      this.loadingHospitals = false;
    }
  }

  private async loadPolice() {
    this.loadingPolice = true;
    try {
      const resp = await firstValueFrom(
        this.placesService.getNearbyPlaces(this.lat, this.lng, 'police', NEARBY_RADIUS_M)
      );
      this.police = this.mapNearbyResults(resp);
      if (resp?.status && resp.status !== 'OK' && resp.status !== 'ZERO_RESULTS') {
        await this.toastShort('Could not load police stations. Try again later.');
      }
    } catch {
      this.police = [];
      await this.toastShort('Could not load police stations.');
    } finally {
      this.loadingPolice = false;
    }
  }

  private async loadEmbassies() {
    this.loadingEmbassy = true;
    this.embassyFallbackMessage = null;
    try {
      let resp = await firstValueFrom(
        this.placesService.getNearbyPlaces(this.lat, this.lng, 'embassy', NEARBY_RADIUS_M)
      );
      let rows = this.mapNearbyResults(resp);

      if (rows.length === 0) {
        resp = await firstValueFrom(
          this.placesService.getNearbyPlaces(this.lat, this.lng, 'embassy', EMBASSY_NEARBY_RETRY_RADIUS_M)
        );
        rows = this.mapNearbyResults(resp);
      }

      if (rows.length === 0) {
        const textResp = await firstValueFrom(
          this.placesService.searchTextNear('embassy consulate', this.lat, this.lng, 50000)
        );
        rows = this.mapNearbyResults(textResp);
        if (rows.length > 0) {
          this.embassyFallbackMessage =
            'Few official embassies nearby; showing consulates and related listings from search.';
        } else if (textResp?.status === 'ERROR') {
          await this.toastShort('Could not load embassy listings. Try again later.');
        }
      }

      this.embassies = rows;
    } catch {
      this.embassies = [];
      await this.toastShort('Could not load embassy listings.');
    } finally {
      this.loadingEmbassy = false;
    }
  }

  private async toastShort(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2800, position: 'bottom' });
    await t.present();
  }

  private async resolveRowCoordinates(row: EmergencyPlaceRow): Promise<{ lat: number; lng: number } | null> {
    let lat = row.lat;
    let lng = row.lng;
    if (lat == null || lng == null) {
      try {
        const detail = await firstValueFrom(this.placesService.getPlaceContactDetails(row.place_id));
        const loc = detail?.result?.geometry?.location;
        if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
          lat = loc.lat;
          lng = loc.lng;
        }
      } catch {
        // handled below
      }
    }
    if (lat == null || lng == null) {
      return null;
    }
    return { lat, lng };
  }

  /**
   * Open the in-app map centered on this place (uses coordinates from Places when available).
   */
  async openInAppMapFromRow(row: EmergencyPlaceRow): Promise<void> {
    const coords = await this.resolveRowCoordinates(row);
    if (!coords) {
      await this.toastShort('Could not get map coordinates for this place.');
      return;
    }
    this.mapFocusIntent.setEmergencyPlaceFocus({
      lat: coords.lat,
      lng: coords.lng,
      name: row.name,
      address: row.vicinity,
      placeId: row.place_id,
    });
    await this.navCtrl.navigateForward('/user-map');
  }

  /**
   * Open the in-app map and load directions from your location to this place (transit or walking).
   */
  async openDirectionsOnAppMap(row: EmergencyPlaceRow): Promise<void> {
    const coords = await this.resolveRowCoordinates(row);
    if (!coords) {
      await this.toastShort('Could not get coordinates for directions.');
      return;
    }
    this.mapFocusIntent.setEmergencyPlaceFocus({
      lat: coords.lat,
      lng: coords.lng,
      name: row.name,
      address: row.vicinity,
      placeId: row.place_id,
      requestDirections: true,
    });
    await this.navCtrl.navigateForward('/user-map');
  }

  async onPlaceTap(row: EmergencyPlaceRow) {
    const loading = await this.loadingCtrl.create({ message: 'Loading…' });
    await loading.present();

    let phone: string | undefined;
    let website: string | undefined;

    try {
      const detail = await firstValueFrom(this.placesService.getPlaceContactDetails(row.place_id));
      const r = detail?.result;
      phone = r?.international_phone_number || r?.formatted_phone_number;
      website = r?.website;
    } catch {
      // still show directions
    } finally {
      await loading.dismiss();
    }

    const header = row.name;
    const buttons: any[] = [
      {
        text: 'View on app map',
        handler: () => {
          void this.openInAppMapFromRow(row);
        },
      },
      {
        text: 'Directions on app map',
        handler: () => {
          void this.openDirectionsOnAppMap(row);
        },
      },
    ];

    if (phone) {
      buttons.push({
        text: `Call ${phone}`,
        handler: () => {
          window.location.href = `tel:${phone!.replace(/\s/g, '')}`;
        },
      });
    }

    if (website) {
      buttons.push({
        text: 'Website',
        handler: () => {
          window.open(website, '_blank', 'noopener,noreferrer');
        },
      });
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({ header, buttons });
    await sheet.present();
  }
}
