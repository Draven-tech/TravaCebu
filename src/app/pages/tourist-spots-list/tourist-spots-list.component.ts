import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import * as L from 'leaflet';
import { AdminAuthService } from '../../services/admin-auth.service';
import { PlacesService } from '../../services/places.service';
import {
  addressLooksLikeCebu,
  categoryFromGoogleTypes,
  exposureFromGooglePlaceTypes,
  tsMillis,
} from '../../lib/tc-utils';

/** Firestore tourist_spots display shape */
export interface TouristSpot {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  exposure?: string;
  googlePlaceId?: string;
  googlePlaceTypes?: string[];
  img?: string;
  location?: unknown;
  createdAt?: unknown;
}

type GeoPointLike = { latitude: () => number; longitude: () => number };

@Component({
  selector: 'app-tourist-spots-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './tourist-spots-list.component.html',
})
export class TouristSpotsListComponent implements OnInit, OnDestroy {
  private readonly authSvc = inject(AdminAuthService);
  private readonly places = inject(PlacesService);
  private readonly router = inject(Router);

  spots: TouristSpot[] = [];
  search = '';
  bulkRunning = false;
  listError = '';
  detailSpot: TouristSpot | null = null;

  private spotsUnsub: (() => void) | null = null;
  private miniMap: L.Map | null = null;
  private readonly esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 },
  );
  private readonly beforeLogout = (): void => {
    try {
      this.stopSpotsListener();
    } catch {
      /* ignore */
    }
  };

  async ngOnInit(): Promise<void> {
    document.addEventListener('tc-before-logout', this.beforeLogout);
    try {
      await this.authSvc.auth.currentUser?.getIdToken(true);
      await this.waitFrame();
      await new Promise((r) => setTimeout(r, 60));
    } catch (e) {
      console.warn('waitForFirestoreAuth', e);
    }
    this.startSpotsListener();
    window.addEventListener('pageshow', this.onPageShow);
  }

  ngOnDestroy(): void {
    document.removeEventListener('tc-before-logout', this.beforeLogout);
    window.removeEventListener('pageshow', this.onPageShow);
    this.stopSpotsListener();
    this.destroyMiniMap();
  }

  private readonly onPageShow = (ev: PageTransitionEvent): void => {
    if (!ev.persisted) return;
    void this.authSvc.auth.currentUser?.getIdToken(true).then(() => {
      this.startSpotsListener();
    });
  };

  private waitFrame(): Promise<void> {
    return new Promise((r) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => r());
      });
    });
  }

  filteredSpots(): TouristSpot[] {
    const q = this.search.trim().toLowerCase();
    return this.spots.filter((s) => {
      if (!q) return true;
      return (
        String(s.name || '')
          .toLowerCase()
          .includes(q) ||
        String(s.description || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }

  closeModal(): void {
    this.destroyMiniMap();
    this.detailSpot = null;
  }

  openDetail(s: TouristSpot): void {
    this.destroyMiniMap();
    this.detailSpot = s;
    setTimeout(() => this.initMiniMap(), 0);
  }

  private destroyMiniMap(): void {
    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }
  }

  private initMiniMap(): void {
    if (!this.detailSpot) return;
    const el = document.getElementById('mmap');
    if (!el) return;
    this.miniMap = L.map(el).setView([10.3157, 123.8854], 14);
    this.esri.addTo(this.miniMap);
    const loc = this.detailSpot.location as
      | { latitude?: number; longitude?: number; lat?: number; lng?: number }
      | GeoPointLike
      | undefined;
    let lat: number | null = null;
    let lng: number | null = null;
    if (loc != null) {
      if (typeof (loc as GeoPointLike).latitude === 'function') {
        const gl = loc as GeoPointLike;
        lat = gl.latitude();
        lng = gl.longitude();
      } else {
        const o = loc as { latitude?: number; longitude?: number; lat?: number; lng?: number };
        lat = (o.latitude ?? o.lat) ?? null;
        lng = (o.longitude ?? o.lng) ?? null;
      }
    }
    if (lat != null && lng != null) {
      L.marker([lat, lng]).addTo(this.miniMap);
      this.miniMap.setView([lat, lng], 15);
    }
  }

  editSpot(s: TouristSpot): void {
    sessionStorage.setItem('spotToEdit', JSON.stringify(s));
    void this.router.navigate(['/admin/tourist-spots/editor'], {
      queryParams: { id: s.id },
    });
  }

  async deleteSpot(s: TouristSpot): Promise<void> {
    if (!confirm('Delete?')) return;
    const snap = await getDoc(doc(this.authSvc.db, 'tourist_spots', s.id));
    const img = snap.get('img') as string | undefined;
    if (img) await this.authSvc.deleteFileByURL(img);
    await deleteDoc(doc(this.authSvc.db, 'tourist_spots', s.id));
  }

  async refresh(): Promise<void> {
    await this.load();
    this.startSpotsListener();
  }

  private stopSpotsListener(): void {
    if (this.spotsUnsub) {
      this.spotsUnsub();
      this.spotsUnsub = null;
    }
  }

  private startSpotsListener(): void {
    this.stopSpotsListener();
    const col = collection(this.authSvc.db, 'tourist_spots');
    const applySnap = (snap: { forEach: (fn: (d: { id: string; data: () => DocumentData }) => void) => void }, sortClient: boolean) => {
      const next: TouristSpot[] = [];
      snap.forEach((d) => next.push({ id: d.id, ...d.data() } as TouristSpot));
      if (sortClient) {
        next.sort((a, b) => tsMillis(b['createdAt'] as Timestamp) - tsMillis(a['createdAt'] as Timestamp));
      }
      this.spots = next;
    };
    const subUnordered = () => {
      this.spotsUnsub = onSnapshot(
        col,
        (snap) => applySnap(snap, true),
        (err) => {
          console.error('tourist_spots listener', err);
          this.listError =
            'Could not load spots. ' + ((err as { code?: string }).code || (err as Error).message);
        },
      );
    };
    const ordered = query(col, orderBy('createdAt', 'desc'));
    this.spotsUnsub = onSnapshot(
      ordered,
      (snap) => applySnap(snap, false),
      (err) => {
        console.warn('tourist_spots: ordered listener failed, trying unordered', err);
        this.stopSpotsListener();
        subUnordered();
      },
    );
  }

  private async load(): Promise<void> {
    this.listError = '';
    try {
      const u = this.authSvc.auth.currentUser;
      if (u) await u.getIdToken(true);
      let snap;
      try {
        const qOrdered = query(collection(this.authSvc.db, 'tourist_spots'), orderBy('createdAt', 'desc'));
        snap = await getDocs(qOrdered);
      } catch (e) {
        console.warn('tourist_spots: server orderBy failed, fallback', e);
        snap = await getDocs(collection(this.authSvc.db, 'tourist_spots'));
      }
      const next: TouristSpot[] = [];
      snap.forEach((d) => next.push({ id: d.id, ...d.data() } as TouristSpot));
      next.sort((a, b) => tsMillis(b['createdAt'] as Timestamp) - tsMillis(a['createdAt'] as Timestamp));
      this.spots = next;
    } catch (e) {
      console.error(e);
      this.listError =
        'Could not load spots. ' + ((e as { code?: string }).code || (e as Error).message);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async bulkSync(): Promise<void> {
    this.bulkRunning = true;
    let updated = 0,
      skippedSynced = 0,
      skippedInvalid = 0,
      noPayload = 0,
      failed = 0;
    let n = 0;
    const all = await getDocs(collection(this.authSvc.db, 'tourist_spots'));
    for (const dDoc of all.docs) {
      if (n >= 25) break;
      const data = dDoc.data();
      const name = String(data['name'] || '').trim();
      const loc = data['location'] as { latitude?: number; longitude?: number; lat?: number; lng?: number } | undefined;
      let lat: number | null = null;
      let lng: number | null = null;
      if (loc != null) {
        lat = (loc.latitude ?? loc.lat) ?? null;
        lng = (loc.longitude ?? loc.lng) ?? null;
      }
      if (!name || lat == null || lng == null) {
        skippedInvalid++;
        continue;
      }
      const gt = (data['googlePlaceTypes'] || data['google_place_types']) as string[] | undefined;
      if (Array.isArray(gt) && gt.length) {
        skippedSynced++;
        continue;
      }
      try {
        const ts = await this.places.textSearch(name);
        if (ts.status !== 'OK' || !ts.results) {
          noPayload++;
          n++;
          await this.sleep(400);
          continue;
        }
        let picked: { place_id?: string; formatted_address?: string } | null = null;
        for (const r of ts.results as { formatted_address?: string; place_id?: string }[]) {
          if (addressLooksLikeCebu(r.formatted_address || '')) {
            picked = r;
            break;
          }
        }
        if (!picked?.place_id) {
          noPayload++;
          n++;
          await this.sleep(400);
          continue;
        }
        const det = await this.places.details(picked.place_id);
        if (det.status !== 'OK' || !det.result) {
          noPayload++;
          n++;
          await this.sleep(400);
          continue;
        }
        const res = det.result;
        const types = (res['types'] as string[]) || [];
        const patch: Record<string, unknown> = {
          googlePlaceTypes: types,
          googlePlaceId: picked.place_id,
          category: categoryFromGoogleTypes(types),
          exposure: exposureFromGooglePlaceTypes(types),
          updatedAt: Timestamp.now(),
        };
        if (res['rating'] != null) patch['rating'] = res['rating'];
        if (res['user_ratings_total'] != null) patch['userRatingsTotal'] = res['user_ratings_total'];
        const photos = res['photos'] as { photo_reference?: string }[] | undefined;
        const pr = photos?.[0]?.photo_reference;
        const url = this.places.photoUrlFromReference(pr || '', 400, 300);
        if (url) patch['img'] = url;
        await setDoc(dDoc.ref, patch, { merge: true });
        updated++;
      } catch (e) {
        failed++;
        console.warn(e);
      }
      n++;
      await this.sleep(400);
    }
    this.bulkRunning = false;
    alert(
      `Updated ${updated}, skipped synced ${skippedSynced}, invalid ${skippedInvalid}, no payload ${noPayload}, failed ${failed}`,
    );
  }
}
