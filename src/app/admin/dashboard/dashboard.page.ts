import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiTrackerService } from '../../services/api-tracker.service';

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
    private apiTracker: ApiTrackerService
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
    console.log('Dashboard navigating to:', route);
    switch (route) {
      case 'route-editor':
        console.log('Navigating to route-editor');
        this.router.navigate(['/admin/route-editor']);
        break;
      case 'route-list':
        console.log('Navigating to route-list');
        this.router.navigate(['/admin/route-list']);
        break;
      case 'tourist-spot-editor':
        console.log('Navigating to tourist-spot-editor');
        this.router.navigate(['/admin/tourist-spot-editor']);
        break;
      case 'tourist-spot-list':
        console.log('Navigating to tourist-spot-list');
        this.router.navigate(['/admin/tourist-spot-list']);
        break;
    }
  }

  logout() {
    // Add logout logic here
    this.router.navigate(['/login']);
  }

  getApiKeys(): string[] {
    return Object.keys(this.apiUsageStats?.byApi || {});
  }

  getApiUsage(api: string): any {
    return this.apiUsageStats?.byApi[api] || { total: 0, today: 0 };
  }
}