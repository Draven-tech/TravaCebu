import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly authSvc = inject(AdminAuthService);

  avatarPhotoUrl: string | null = null;
  avatarInitial = 'A';
  avatarTitle = 'Admin';
  whoLabel = '';
  apiLoading = true;
  apiError = '';
  apiTotal = 0;
  apiToday = 0;
  apiByLines: string[] = [];

  async ngOnInit(): Promise<void> {
    const u = this.authSvc.auth.currentUser;
    if (u) {
      this.whoLabel = 'Signed in as ' + (u.email || u.uid) + '.';
      this.avatarPhotoUrl = u.photoURL || null;
      const label = (u.displayName || u.email || u.uid || 'A').trim();
      this.avatarInitial = label[0]!.toUpperCase();
      this.avatarTitle = u.displayName?.trim() || u.email || 'Admin';
    }
    await this.loadApiUsage();
  }

  async logout(): Promise<void> {
    await this.authSvc.logout();
  }

  private async loadApiUsage(): Promise<void> {
    this.apiLoading = true;
    this.apiError = '';
    try {
      let total = 0;
      let today = 0;
      const byApi: Record<string, { total: number; today: number }> = {};
      const todayStr = new Date().toISOString().slice(0, 10);
      const snap = await getDocs(collectionGroup(this.authSvc.db, 'calls'));
      snap.forEach((docSnap) => {
        const d = docSnap.data() as { api?: string; date?: string };
        const api = d.api || 'unknown';
        const date = d.date || '';
        total++;
        if (date === todayStr) today++;
        byApi[api] = byApi[api] || { total: 0, today: 0 };
        byApi[api].total++;
        if (date === todayStr) byApi[api].today++;
      });
      this.apiTotal = total;
      this.apiToday = today;
      this.apiByLines = Object.entries(byApi).map(
        ([k, v]) => `${k}: ${v.total} total · ${v.today} today`,
      );
      if (this.apiByLines.length === 0) {
        this.apiByLines = ['No API usage logged yet.'];
      }
    } catch (e) {
      console.warn(e);
      this.apiError =
        'Could not load api_usage. Create a Firestore composite index if the console links one from collectionGroup(calls).';
    } finally {
      this.apiLoading = false;
    }
  }
}
