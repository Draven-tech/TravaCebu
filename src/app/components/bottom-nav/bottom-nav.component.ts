import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subscription, filter } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-bottom-nav',
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
})
export class BottomNavComponent implements OnInit, OnDestroy {
  currentPage: string = 'user-dashboard';
  userId: string | null = null;
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth
  ) {}

  async ngOnInit() {
    // Get current user ID
    const currentUser = await this.afAuth.currentUser;
    this.userId = currentUser?.uid || null;
    
    // Set initial current page
    this.updateCurrentPage(this.router.url);
    
    // Subscribe to router events to update current page
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateCurrentPage(event.url);
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private updateCurrentPage(url: string) {
    if (url.includes('user-dashboard')) {
      this.currentPage = 'user-dashboard';
    } else if (url.includes('bucket-list')) {
      this.currentPage = 'bucket-list';
    } else if (url.includes('user-map')) {
      this.currentPage = 'user-map';
    } else if (url.includes('user-calendar')) {
      this.currentPage = 'user-calendar';
    } else if (url.includes('user-profile')) {
      this.currentPage = 'user-profile';
    } else if (url.includes('tourist-spot-detail')) {
      // For tourist spot detail pages, keep the previous page active or default to dashboard
      // Don't change currentPage to avoid navigation issues
      return;
    }
  }

  async navigateTo(page: string) {
    this.currentPage = page;
    
    // Get current user ID if not already set
    if (!this.userId) {
      const currentUser = await this.afAuth.currentUser;
      this.userId = currentUser?.uid || null;
    }
    
    // Navigate with user ID for user-specific pages
    if (page === 'user-dashboard' && this.userId) {
      this.router.navigate([`/user-dashboard/${this.userId}`]);
    } else if (page === 'user-calendar' && this.userId) {
      this.router.navigate([`/user-calendar/${this.userId}`]);
    } else if (page === 'user-profile' && this.userId) {
      this.router.navigate([`/user-profile/${this.userId}`]);
    } else {
      this.router.navigate([`/${page}`]);
    }
  }
}
