import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminUiService } from '../../services/admin-ui.service';

export interface Ev {
  id: string;
  name?: string;
  date?: string;
  time?: string;
  endTime?: string;
  location?: string;
  imageUrl?: string;
  createdBy?: string;
  createdByType?: string;
}

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './events-list.component.html',
})
export class EventsListComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);
  private readonly ui = inject(AdminUiService);

  events: Ev[] = [];
  search = '';
  page = 0;
  readonly perPage = 6;
  calY = new Date().getUTCFullYear();
  calM = new Date().getUTCMonth();
  tab: 'list' | 'cal' = 'list';
  modalEv: Ev | null = null;
  uid = '';
  tabPanelLoading = false;

  async ngOnInit(): Promise<void> {
    await this.authSvc.auth.authStateReady();
    const u = this.authSvc.auth.currentUser;
    if (u) this.uid = u.uid;
    await this.load();
  }

  evKey(e: Ev): string {
    return (e['date'] as string) + 'T' + (e['time'] as string);
  }

  sortEv(): Ev[] {
    const now = Date.now();
    const t = this.events.map((e) => ({
      e,
      ts: Date.parse((e['date'] as string) + 'T' + (e['time'] as string) + ':00Z') || 0,
    }));
    return t
      .filter((x) => x.ts >= now)
      .sort((a, b) => a.ts - b.ts)
      .map((x) => x.e)
      .concat(
        t
          .filter((x) => x.ts < now)
          .sort((a, b) => b.ts - a.ts)
          .map((x) => x.e),
      );
  }

  listSlice(): Ev[] {
    const all = this.sortEv().filter((e) => {
      const q = this.search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(e['name'] || '')
          .toLowerCase()
          .includes(q) ||
        String(e['location'] || '')
          .toLowerCase()
          .includes(q)
      );
    });
    return all.slice(this.page * this.perPage, this.page * this.perPage + this.perPage);
  }

  listTotal(): number {
    const q = this.search.trim().toLowerCase();
    return this.sortEv().filter((e) => {
      if (!q) return true;
      return (
        String(e['name'] || '')
          .toLowerCase()
          .includes(q) ||
        String(e['location'] || '')
          .toLowerCase()
          .includes(q)
      );
    }).length;
  }

  pageLabel(): string {
    return 'Page ' + (this.page + 1) + ' · ' + this.listTotal();
  }

  async del(e: Ev): Promise<void> {
    if (
      !(await this.ui.confirm('Delete this event? This cannot be undone.', {
        title: 'Delete event',
        danger: true,
        okLabel: 'Delete',
      }))
    ) {
      return;
    }
    const img = e['imageUrl'] as string | undefined;
    if (img) await this.authSvc.deleteFileByURL(img);
    await deleteDoc(doc(this.authSvc.db, 'events', e.id));
    await this.load();
    this.closeModal();
  }

  openM(e: Ev): void {
    this.modalEv = e;
  }

  closeModal(): void {
    this.modalEv = null;
  }

  calTitle(): string {
    return new Date(Date.UTC(this.calY, this.calM, 1)).toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  calGrid(): { day: number; iso: string; count: number }[] {
    const first = new Date(Date.UTC(this.calY, this.calM, 1)).getUTCDay();
    const dim = new Date(Date.UTC(this.calY, this.calM + 1, 0)).getUTCDate();
    const by: Record<string, Ev[]> = {};
    this.events.forEach((e) => {
      const d = e['date'] as string;
      if (!d) return;
      by[d] = by[d] || [];
      by[d].push(e);
    });
    const cells: { day: number; iso: string; count: number }[] = [];
    for (let i = 0; i < first; i++) cells.push({ day: 0, iso: '', count: 0 });
    for (let day = 1; day <= dim; day++) {
      const iso =
        this.calY +
        '-' +
        String(this.calM + 1).padStart(2, '0') +
        '-' +
        String(day).padStart(2, '0');
      cells.push({ day, iso, count: (by[iso] || []).length });
    }
    return cells;
  }

  async openCalDay(iso: string): Promise<void> {
    const by: Record<string, Ev[]> = {};
    this.events.forEach((e) => {
      const d = e['date'] as string;
      if (!d) return;
      by[d] = by[d] || [];
      by[d].push(e);
    });
    const list = by[iso] || [];
    if (list.length === 1) this.openM(list[0]);
    else if (list.length > 1) {
      const n = await this.ui.pickNumber({
        title: 'Which event?',
        message: 'Enter the number for the event you want (see list below).',
        detail: list.map((ev, i) => `${i + 1}. ${ev.name || '(no name)'} — ${ev.location || ''}`).join('\n'),
        min: 1,
        max: list.length,
        defaultValue: 1,
      });
      if (n != null && n >= 1 && n <= list.length) this.openM(list[n - 1]);
    }
  }

  async load(): Promise<void> {
    const snap = await getDocs(collection(this.authSvc.db, 'events'));
    this.events = [];
    snap.forEach((d) => {
      const x = d.data();
      if (x['createdBy'] === this.uid && x['createdByType'] === 'admin') {
        this.events.push({ id: d.id, ...x } as Ev);
      }
    });
  }

  prevPage(): void {
    if (this.page > 0) this.page--;
  }

  nextPage(): void {
    this.page++;
  }

  prevMonth(): void {
    this.calM--;
    if (this.calM < 0) {
      this.calM = 11;
      this.calY--;
    }
  }

  nextMonth(): void {
    this.calM++;
    if (this.calM > 11) {
      this.calM = 0;
      this.calY++;
    }
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }

  setTab(t: 'list' | 'cal'): void {
    if (this.tab === t) return;
    this.tabPanelLoading = true;
    this.tab = t;
    const t0 = performance.now();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rest = Math.max(0, 140 - (performance.now() - t0));
        setTimeout(() => {
          this.tabPanelLoading = false;
        }, rest);
      });
    });
  }
}
