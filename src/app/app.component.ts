import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AdminUiOverlayComponent } from './components/admin-ui-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AdminUiOverlayComponent],
  template: '<router-outlet /><app-admin-ui-overlay />',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const login = e.urlAfterRedirects.startsWith('/admin/login');
        document.body.classList.add('tc-admin');
        document.body.classList.toggle('tc-admin-login', login);
      });
  }
}
