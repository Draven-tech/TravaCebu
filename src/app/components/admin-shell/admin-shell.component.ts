import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { AdminAuthService } from '../../services/admin-auth.service';
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
})
export class AdminShellComponent implements OnInit, OnDestroy {
  private readonly authSvc = inject(AdminAuthService);

  userEmail = '';
  avatarInitial = 'A';
  avatarPhotoUrl: string | null = null;

  pendingSpotCount = 0;
  pendingTipCount = 0;

  private unsubSpots?: Unsubscribe;
  private unsubTips?: Unsubscribe;

  ngOnInit(): void {
    const u = this.authSvc.auth.currentUser;
    if (u) {
      this.userEmail = u.email || u.uid || '';
      this.avatarPhotoUrl = u.photoURL || null;
      const label = (u.displayName || u.email || u.uid || 'A').trim();
      this.avatarInitial = label[0]!.toUpperCase();
    }

    this.subscribePendingCounts();
  }

  ngOnDestroy(): void {
    this.unsubSpots?.();
    this.unsubTips?.();
  }

  private subscribePendingCounts(): void {
    const db = this.authSvc.db;

    this.unsubSpots = onSnapshot(
      query(collection(db, 'pending_tourist_spots'), where('status', '==', 'pending')),
      (snap) => { this.pendingSpotCount = snap.size; },
      () => { /* silence permission errors on logout */ },
    );

    this.unsubTips = onSnapshot(
      query(collection(db, 'pending_local_tips'), where('status', '==', 'pending')),
      (snap) => { this.pendingTipCount = snap.size; },
      () => { /* silence permission errors on logout */ },
    );
  }

  async logout(): Promise<void> {
    this.unsubSpots?.();
    this.unsubTips?.();
    await this.authSvc.logout();
  }
}
