import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AdminUiOverlayComponent } from './components/admin-ui-overlay.component';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AdminUiOverlayComponent, ThemeToggleComponent],
  template: '<router-outlet /><app-admin-ui-overlay /><app-theme-toggle />',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly router = inject(Router);

  constructor() {
    inject(ThemeService);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const login = e.urlAfterRedirects.startsWith('/admin/login');
        document.body.classList.add('tc-admin');
        document.body.classList.toggle('tc-admin-login', login);
      });
  }
}
