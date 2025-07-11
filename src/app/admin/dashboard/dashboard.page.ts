import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  navigateTo(route: string) {
    this.router.navigate(['/admin', route]);
  }

  logout() {
    this.authService.logout();
  }
}