import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  constructor(private router: Router) {}

  navigateTo(route: string) {
    this.router.navigateByUrl(`/admin/${route}`);
  }
}