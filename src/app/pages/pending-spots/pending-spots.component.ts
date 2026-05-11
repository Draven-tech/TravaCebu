import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  GeoPoint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AdminAuthService } from '../../services/admin-auth.service';
import { exposureFromGooglePlaceTypes } from '../../lib/tc-utils';
import type { DocumentData, UpdateData } from 'firebase/firestore';

@Component({
  selector: 'app-pending-spots',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pending-spots.component.html',
})
export class PendingSpotsComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);

  status: 'pending' | 'approved' | 'rejected' = 'pending';
  rows: { id: string; data: DocumentData }[] = [];
  uid = '';
  /** Shown while Firestore loads after changing status segment. */
  tabPanelLoading = false;

  async ngOnInit(): Promise<void> {
    await this.authSvc.auth.authStateReady();
    const u = this.authSvc.auth.currentUser;
    if (u) this.uid = u.uid;
    await this.load();
  }

  geoFromPending(loc: unknown): GeoPoint {
    if (!loc || typeof loc !== 'object') return new GeoPoint(0, 0);
    const o = loc as { latitude?: number; longitude?: number; lat?: number; lng?: number };
    if (typeof o.latitude === 'number' && typeof o.longitude === 'number')
      return new GeoPoint(o.latitude, o.longitude);
    if (o.lat != null && o.lng != null) return new GeoPoint(o.lat, o.lng);
    return new GeoPoint(0, 0);
  }

  async load(): Promise<void> {
    this.tabPanelLoading = true;
    try {
      const snap = await getDocs(
        query(collection(this.authSvc.db, 'pending_tourist_spots'), where('status', '==', this.status)),
      );
      this.rows = [];
      snap.forEach((d) => this.rows.push({ id: d.id, data: d.data() }));
    } finally {
      this.tabPanelLoading = false;
    }
  }

  async approve(row: { id: string; data: DocumentData }): Promise<void> {
    const notes = prompt('Optional notes') || '';
    const docRef = doc(this.authSvc.db, 'pending_tourist_spots', row.id);
    const p = (await getDoc(docRef)).data();
    if (!p) return;
    if ((p['status'] || '') !== 'pending') return alert('Not pending');
    const submittedAt = (p['submittedAt'] as Timestamp) || Timestamp.now();
    const now = Timestamp.now();
    const newSpot: Record<string, unknown> = {
      name: p['name'] || '',
      description: p['description'] || '',
      category: p['category'] || 'attraction',
      location: this.geoFromPending(p['location']),
      img: p['img'] || '',
      googlePlaceId: p['googlePlaceId'] || '',
      rating: p['rating'] ?? 0,
      userRatingsTotal: p['userRatingsTotal'] ?? 0,
      createdAt: submittedAt,
      updatedAt: now,
      approvedFrom: row.id,
      approvedBy: this.uid,
      approvedAt: now,
    };
    const gpt = p['googlePlaceTypes'] as string[] | undefined;
    if (gpt?.length) {
      newSpot['googlePlaceTypes'] = gpt;
      newSpot['exposure'] = exposureFromGooglePlaceTypes(gpt);
    }
    const refNew = await addDoc(collection(this.authSvc.db, 'tourist_spots'), newSpot);
    const upd: Record<string, unknown> = {
      status: 'approved',
      reviewedAt: now,
      reviewedBy: this.uid,
      approvedSpotId: refNew.id,
    };
    if (notes) upd['reviewNotes'] = notes;
    await updateDoc(docRef, upd as UpdateData<DocumentData>);
    await this.load();
  }

  async reject(row: { id: string; data: DocumentData }): Promise<void> {
    const notes = prompt('Rejection notes (required)') || '';
    if (!notes.trim()) return alert('Notes required');
    await updateDoc(doc(this.authSvc.db, 'pending_tourist_spots', row.id), {
      status: 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy: this.uid,
      reviewNotes: notes,
    });
    await this.load();
  }

  async removeRow(row: { id: string }): Promise<void> {
    if (!confirm('Delete doc?')) return;
    await deleteDoc(doc(this.authSvc.db, 'pending_tourist_spots', row.id));
    await this.load();
  }

  setStatus(s: 'pending' | 'approved' | 'rejected'): void {
    this.status = s;
    void this.load();
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }

  /** Image URL on `pending_tourist_spots` (e.g. photo URL from submission). */
  spotImage(row: { data: DocumentData }): string | null {
    const v = row.data['img'];
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length ? t : null;
  }
}
