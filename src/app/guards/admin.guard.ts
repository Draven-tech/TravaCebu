import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  async canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    // Skip guard check for login page
    if (state.url.includes('/login')) {
      return true;
    }
  
    const isAdmin = await this.authService.isAdmin();
    
    if (isAdmin) {
      return true;
    } else {
      // Redirect to login with return URL
      return this.router.createUrlTree(['/admin/login'], {
        queryParams: { returnUrl: state.url }
      });
    }
  }
}