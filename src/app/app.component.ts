import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
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
