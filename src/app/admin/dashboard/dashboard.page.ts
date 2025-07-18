import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  apiUsageSummary: any[] = [];
  loadingApiUsage = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    this.fetchApiUsage();
  }

  fetchApiUsage() {
    this.loadingApiUsage = true;
    this.firestore.collectionGroup('calls').valueChanges({ idField: 'id' })
      .subscribe((calls: any[]) => {
        const summary: { [user: string]: { [api: string]: number } } = {};
        calls.forEach(call => {
          const userId = call.userId || 'unknown';
          if (!summary[userId]) summary[userId] = {};
          if (!summary[userId][call.api]) summary[userId][call.api] = 0;
          summary[userId][call.api]++;
        });
        // Convert to array for display
        this.apiUsageSummary = Object.entries(summary).map(([userId, apis]) => ({
          userId,
          ...apis
        }));
        this.loadingApiUsage = false;
      }, () => {
        this.loadingApiUsage = false;
      });
  }

  navigateTo(route: string) {
    this.router.navigate(['/admin', route]);
  }

  logout() {
    this.authService.logout();
  }

  getApiKeys(user: any): string[] {
    return Object.keys(user).filter(key => key !== 'userId');
  }
}