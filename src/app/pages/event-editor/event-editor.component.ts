import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Timestamp, addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AdminAuthService } from '../../services/admin-auth.service';

export interface SpotPickRow {
  id: string;
  name?: string;
  category?: string;
  description?: string;
}

@Component({
  selector: 'app-event-editor',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './event-editor.component.html',
})
export class EventEditorComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  name = '';
  desc = '';
  date = '';
  time = '';
  endTime = '';
  spotId = '';
  spotName = '';
  imageUrl = '';
  file: File | null = null;
  previewUrl = '';

  pickOpen = false;
  pickSearch = '';
  spots: SpotPickRow[] = [];

  eventId: string | null = null;
  uid = '';

  async ngOnInit(): Promise<void> {
    await this.authSvc.auth.authStateReady();
    const u = this.authSvc.auth.currentUser;
    if (u) this.uid = u.uid;
    const id = this.route.snapshot.queryParamMap.get('id');
    if (!id) return;
    this.eventId = id;
    const snap = await getDoc(doc(this.authSvc.db, 'events', id));
    if (!snap.exists()) return;
    const e = snap.data();
    this.name = (e['name'] as string) || '';
    this.desc = (e['description'] as string) || '';
    this.date = (e['date'] as string) || '';
    this.time = this.normTime(e['time'] as string);
    this.endTime = this.normTime(e['endTime'] as string);
    this.spotId = (e['spotId'] as string) || '';
    this.spotName = (e['location'] as string) || '';
    this.imageUrl = (e['imageUrl'] as string) || '';
    if (this.imageUrl) this.previewUrl = this.imageUrl;
  }

  normTime(t: string | undefined): string {
    const s = String(t || '');
    const m = s.match(/^(\d{2}):(\d{2})/);
    return m ? m[1] + ':' + m[2] : s;
  }

  async openPick(): Promise<void> {
    const snap = await getDocs(collection(this.authSvc.db, 'tourist_spots'));
    this.spots = [];
    snap.forEach((d) => this.spots.push({ id: d.id, ...d.data() } as SpotPickRow));
    this.spots.sort((a, b) => String(a['name'] || '').localeCompare(String(b['name'] || '')));
    this.pickOpen = true;
  }

  closePick(): void {
    this.pickOpen = false;
  }

  filteredSpots(): SpotPickRow[] {
    const q = this.pickSearch.trim().toLowerCase();
    return this.spots.filter((s) => {
      const hay =
        String(s['name'] || '') +
        ' ' +
        String(s['category'] || '') +
        ' ' +
        String(s['description'] || '');
      if (!q) return true;
      return hay.toLowerCase().includes(q);
    });
  }

  selectSpot(s: SpotPickRow): void {
    this.spotId = s.id;
    this.spotName = (s['name'] as string) || '';
    this.pickOpen = false;
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

  async save(): Promise<void> {
    const name = this.name.trim();
    const date = this.date;
    const time = this.normTime(this.time);
    const endTime = this.normTime(this.endTime);
    if (!name || !date || !time || !endTime || !this.spotId) return alert('Fill required fields & pick spot');
    if (endTime <= time) return alert('End must be after start');
    let img = this.imageUrl;
    if (this.file) {
      const path = 'events/' + Date.now() + '_' + (this.file.name || 'img').replace(/\W+/g, '_');
      const r = ref(this.authSvc.storage, path);
      await uploadBytes(r, this.file);
      img = await getDownloadURL(r);
    }
    const col = collection(this.authSvc.db, 'events');
    const now = Timestamp.now();
    if (this.eventId) {
      const prev = await getDoc(doc(this.authSvc.db, 'events', this.eventId));
      const old = prev.get('imageUrl') as string | undefined;
      if (old && old !== img) await this.authSvc.deleteFileByURL(old);
      await setDoc(
        doc(this.authSvc.db, 'events', this.eventId),
        {
          name,
          description: this.desc || '',
          date,
          time,
          endTime,
          spotId: this.spotId,
          location: this.spotName,
          imageUrl: img || '',
          updatedAt: now,
        },
        { merge: true },
      );
    } else {
      await addDoc(col, {
        name,
        description: this.desc || '',
        date,
        time,
        endTime,
        spotId: this.spotId,
        location: this.spotName,
        imageUrl: img || '',
        createdBy: this.uid,
        createdByType: 'admin',
        eventType: 'admin_event',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    await this.router.navigateByUrl(this.eventId ? '/admin/events' : '/admin/dashboard');
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }
}
