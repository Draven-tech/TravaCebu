import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiTrackerService } from '../../services/api-tracker.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  apiUsageStats: any = null;
  loadingApiUsage = false;

  constructor(
    private router: Router,
    private apiTracker: ApiTrackerService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadApiUsageStats();
  }

  async loadApiUsageStats() {
    try {
      this.loadingApiUsage = true;
      this.apiUsageStats = await this.apiTracker.getApiUsageStats();
    } catch (error) {
      console.error('Error loading API usage stats:', error);
      this.apiUsageStats = { total: 0, today: 0, byApi: {} };
    } finally {
      this.loadingApiUsage = false;
    }
  }

  navigateTo(route: string) {
    switch (route) {
      case 'route-editor':
        this.router.navigate(['/admin/route-editor']);
        break;
      case 'route-list':
        this.router.navigate(['/admin/route-list']);
        break;
      case 'tourist-spot-editor':
        this.router.navigate(['/admin/tourist-spot-editor']);
        break;
      case 'tourist-spot-list':
        this.router.navigate(['/admin/tourist-spot-list']);
        break;
      case 'event-editor':
        this.router.navigate(['/admin/event-editor']);
        break;
      case 'event-list':
        this.router.navigate(['/admin/event-list']);
        break;
      case 'pending-spots':
        this.router.navigate(['/admin/pending-spots']);
        break;
    }
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback navigation
      this.router.navigate(['/admin/login']);
    }
  }

  getApiKeys(): string[] {
    return Object.keys(this.apiUsageStats?.byApi || {});
  }

  getApiUsage(api: string): any {
    return this.apiUsageStats?.byApi[api] || { total: 0, today: 0 };
  }
}
