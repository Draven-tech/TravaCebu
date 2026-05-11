import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  GeoPoint,
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as L from 'leaflet';
import { AdminAuthService } from '../../services/admin-auth.service';
import { PlacesService } from '../../services/places.service';
import {
  categoryFromGoogleTypes,
  exposureFromGooglePlaceTypes,
} from '../../lib/tc-utils';

@Component({
  selector: 'app-tourist-spot-editor',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './tourist-spot-editor.component.html',
})
export class TouristSpotEditorComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);
  private readonly places = inject(PlacesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  tile: 'esri' | 'osm' = 'esri';
  name = '';
  category = 'attraction';
  exposure = '';
  desc = '';
  previewUrl = '';
  file: File | null = null;

  spotId: string | null = null;
  googlePlacesImageUrl = '';
  googlePlaceTypes: string[] = [];
  googlePlaceId = '';

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private readonly esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 },
  );
  private readonly osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      const snap = await getDoc(doc(this.authSvc.db, 'tourist_spots', id));
      if (snap.exists()) {
        this.spotId = id;
        const s = snap.data();
        this.applyFormFromData(s);
        const loc = snap.get('location') as GeoPoint | undefined;
        if (loc) {
          setTimeout(() => this.setMarker(loc.latitude, loc.longitude), 0);
        }
        return;
      }
    }
    const raw = sessionStorage.getItem('spotToEdit');
    if (raw) {
      try {
        const s = JSON.parse(raw) as Record<string, unknown>;
        this.spotId = (s['id'] as string) || null;
        this.applyFormFromData(s);
        this.googlePlaceId = (s['googlePlaceId'] as string) || '';
        this.googlePlaceTypes = (s['googlePlaceTypes'] as string[]) || [];
        const loc = s['location'] as { lat?: number; lng?: number; latitude?: number; longitude?: number } | undefined;
        if (loc?.lat != null && loc?.lng != null) {
          setTimeout(() => this.setMarker(loc.lat!, loc.lng!), 0);
        } else if (loc?.latitude != null && loc?.longitude != null) {
          setTimeout(() => this.setMarker(loc.latitude!, loc.longitude!), 0);
        }
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => this.ensureMap(), 0);
  }

  private applyFormFromData(s: Record<string, unknown>): void {
    this.name = (s['name'] as string) || '';
    this.desc = (s['description'] as string) || '';
    this.category = (s['category'] as string) || 'attraction';
    this.exposure = (s['exposure'] as string) || '';
    this.googlePlaceId = (s['googlePlaceId'] as string) || '';
    this.googlePlaceTypes = (s['googlePlaceTypes'] as string[]) || [];
    this.googlePlacesImageUrl = (s['img'] as string) || '';
    if (this.googlePlacesImageUrl) {
      this.previewUrl = this.googlePlacesImageUrl;
    }
  }

  private ensureMap(): void {
    if (this.map) return;
    const el = document.getElementById('map');
    if (!el) return;
    this.map = L.map(el, { center: [10.3157, 123.8854], zoom: 15, layers: [this.esri] });
    this.map.on('click', (e) => this.setMarker(e.latlng.lat, e.latlng.lng));
    if (this.marker) {
      const ll = this.marker.getLatLng();
      this.map.setView(ll, 15);
    }
  }

  onTileChange(): void {
    if (!this.map) return;
    if (this.tile === 'esri') {
      this.map.removeLayer(this.osm);
      this.esri.addTo(this.map);
    } else {
      this.map.removeLayer(this.esri);
      this.osm.addTo(this.map);
    }
  }

  setMarker(lat: number, lng: number): void {
    this.ensureMap();
    if (!this.map) return;
    if (this.marker) this.map.removeLayer(this.marker);
    this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
    this.map.setView([lat, lng], 15);
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    this.file = f ?? null;
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      this.previewUrl = String(r.result);
    };
    r.readAsDataURL(f);
  }

  async searchPlaces(): Promise<void> {
    const q = prompt('Place name');
    if (!q) return;
    const ts = await this.places.textSearch(q);
    if (ts.status !== 'OK' || !ts.results?.length) {
      alert('No results');
      return;
    }
    const results = ts.results as {
      name?: string;
      formatted_address?: string;
      place_id?: string;
    }[];
    let msg = 'Pick 1-' + results.length + ':\n';
    results.forEach((x, i) => {
      msg += i + 1 + '. ' + x.name + ' — ' + (x.formatted_address || '') + '\n';
    });
    const pick = parseInt(prompt(msg, '1') || '0', 10);
    if (pick < 1 || pick > results.length) return;
    const sel = results[pick - 1];
    if (!sel.place_id) return;
    const det = await this.places.details(sel.place_id);
    if (det.status !== 'OK' || !det.result) {
      alert('Details failed');
      return;
    }
    const res = det.result;
    this.googlePlaceId = sel.place_id;
    this.googlePlaceTypes = (res['types'] as string[]) || [];
    this.name = (res['name'] as string) || '';
    this.category = categoryFromGoogleTypes(this.googlePlaceTypes);
    this.desc = (res['formatted_address'] as string) || '';
    const geom = res['geometry'] as { location?: { lat: number; lng: number } } | undefined;
    if (geom?.location) {
      this.setMarker(geom.location.lat, geom.location.lng);
    }
    const photos = res['photos'] as { photo_reference?: string }[] | undefined;
    const pr = photos?.[0]?.photo_reference;
    this.googlePlacesImageUrl = this.places.photoUrlFromReference(pr || '') || '';
    if (this.googlePlacesImageUrl) {
      this.previewUrl = this.googlePlacesImageUrl;
    }
  }

  async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) return alert('Name required');
    if (!this.marker) return alert('Pick map location');
    const ll = this.marker.getLatLng();
    let img = this.googlePlacesImageUrl;
    if (this.file) {
      const path =
        'tourist_spots/' + Date.now() + '_' + (this.file.name || 'photo').replace(/\W+/g, '_');
      const r = ref(this.authSvc.storage, path);
      await uploadBytes(r, this.file);
      img = await getDownloadURL(r);
    }
    const gp = new GeoPoint(ll.lat, ll.lng);
    const now = Timestamp.now();
    const payload: Record<string, unknown> = {
      name,
      description: this.desc || '',
      category: this.category.trim() || 'attraction',
      location: gp,
      img: img || '',
      googlePlaceId: this.googlePlaceId,
      rating: 0,
      userRatingsTotal: 0,
      updatedAt: now,
    };
    if (this.googlePlaceTypes.length) {
      payload['googlePlaceTypes'] = this.googlePlaceTypes;
      payload['exposure'] =
        this.exposure || exposureFromGooglePlaceTypes(this.googlePlaceTypes);
    } else if (this.exposure) {
      payload['exposure'] = this.exposure;
    }
    const col = collection(this.authSvc.db, 'tourist_spots');
    if (this.spotId) {
      await setDoc(doc(this.authSvc.db, 'tourist_spots', this.spotId), payload, { merge: true });
    } else {
      payload['createdAt'] = now;
      await addDoc(col, payload);
    }
    sessionStorage.removeItem('spotToEdit');
    await this.router.navigateByUrl(this.spotId ? '/admin/tourist-spots' : '/admin/dashboard');
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }
}
